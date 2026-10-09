import { ApplicationCommandOptionType, PermissionsBitField } from 'discord.js';
import { HeliumCommand } from '../core/types.js';
import { EconomyService } from '../services/economy.service.js';

export const economyCommands: HeliumCommand[] = [
  {
    name: 'balance',
    description: 'Check your wallet, bank, and net worth balance',
    category: 'Economy',
    aliases: ['bal', 'wallet', 'bank', 'money', 'cash'],
    slashOptions: [
      { name: 'user', description: 'User to check balance for', type: ApplicationCommandOptionType.User, required: false },
    ],
    execute: async (ctx) => {
      const user = (ctx.interaction ? ctx.interaction.options.getUser('user') : ctx.message?.mentions.users.first()) || ctx.user;
      const b = EconomyService.getBalance(user.id);

      return ctx.replyInfo(
        `${user.username} — Financial Balance`,
        `**Wallet:** \`$${b.wallet.toLocaleString()}\`\n` +
        `**Bank:** \`$${b.bank.toLocaleString()}\` / \`$${b.capacity.toLocaleString()}\`\n` +
        `**Net Worth:** \`$${b.total.toLocaleString()}\``
      );
    },
  },
  {
    name: 'daily',
    description: 'Claim your daily financial stipend',
    category: 'Economy',
    aliases: ['dailyreward', 'claimdaily', 'bonus'],
    execute: async (ctx) => {
      const res = EconomyService.claimDaily(ctx.user.id);
      if (!res.success) {
        const hours = Math.ceil(res.nextClaimInMs! / (1000 * 60 * 60));
        return ctx.replyWarning('Daily On Cooldown', `You already claimed your daily stipend. Come back in **${hours}h**.`);
      }
      return ctx.replySuccess('Daily Stipend Claimed', `You received **$${res.amount?.toLocaleString()}** into your wallet!`);
    },
  },
  {
    name: 'weekly',
    description: 'Claim your weekly economic bonus',
    category: 'Economy',
    aliases: ['weeklyreward', 'claimweekly'],
    execute: async (ctx) => {
      const res = EconomyService.claimWeekly(ctx.user.id);
      if (!res.success) {
        const days = Math.ceil(res.nextClaimInMs! / (1000 * 60 * 60 * 24));
        return ctx.replyWarning('Weekly On Cooldown', `Weekly reward already collected. Available in **${days}d**.`);
      }
      return ctx.replySuccess('Weekly Bonus Claimed', `You collected **$${res.amount?.toLocaleString()}** in weekly bonus credits!`);
    },
  },
  {
    name: 'deposit',
    description: 'Transfer funds from wallet into your secure bank account',
    category: 'Economy',
    aliases: ['dep', 'bankdep', 'savemoney'],
    slashOptions: [
      { name: 'amount', description: 'Amount to deposit', type: ApplicationCommandOptionType.Integer, required: true },
    ],
    execute: async (ctx) => {
      const amount = ctx.interaction ? ctx.interaction.options.getInteger('amount', true) : parseInt(ctx.args[0] || '0');
      const res = EconomyService.deposit(ctx.user.id, amount);
      if (res.success) return ctx.replySuccess('Bank Deposit', res.message);
      return ctx.replyError('Deposit Failed', res.message);
    },
  },
  {
    name: 'withdraw',
    description: 'Withdraw funds from bank into wallet',
    category: 'Economy',
    aliases: ['with', 'takecash', 'bankwith'],
    slashOptions: [
      { name: 'amount', description: 'Amount to withdraw', type: ApplicationCommandOptionType.Integer, required: true },
    ],
    execute: async (ctx) => {
      const amount = ctx.interaction ? ctx.interaction.options.getInteger('amount', true) : parseInt(ctx.args[0] || '0');
      const res = EconomyService.withdraw(ctx.user.id, amount);
      if (res.success) return ctx.replySuccess('Bank Withdrawal', res.message);
      return ctx.replyError('Withdrawal Failed', res.message);
    },
  },
  {
    name: 'pay',
    description: 'Transfer funds directly to another user',
    category: 'Economy',
    aliases: ['give', 'transfer', 'sendmoney', 'wire'],
    slashOptions: [
      { name: 'user', description: 'Recipient user', type: ApplicationCommandOptionType.User, required: true },
      { name: 'amount', description: 'Amount to send', type: ApplicationCommandOptionType.Integer, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      const amount = ctx.interaction ? ctx.interaction.options.getInteger('amount', true) : parseInt(ctx.args[1] || '0');

      if (!user || user.id === ctx.user.id) return ctx.replyError('Invalid Target', 'Cannot send funds to yourself.');
      const res = EconomyService.transfer(ctx.user.id, user.id, amount);
      if (res.success) return ctx.replySuccess('Payment Completed', res.message);
      return ctx.replyError('Payment Failed', res.message);
    },
  },
  {
    name: 'shop',
    description: 'Browse the server market store',
    category: 'Economy',
    aliases: ['store', 'market', 'itemshop', 'buyables'],
    execute: async (ctx) => {
      const items = EconomyService.getShopItems();
      const text = items.map(i => `**${i.name}** — \`$${i.price.toLocaleString()}\`\n> ${i.description}`).join('\n\n');
      return ctx.replyInfo('Helium Market Store', text || 'No store items available.');
    },
  },
  {
    name: 'buy',
    description: 'Purchase an item from the market store',
    category: 'Economy',
    aliases: ['purchase', 'orderitem'],
    slashOptions: [
      { name: 'item', description: 'Item name to buy', type: ApplicationCommandOptionType.String, required: true },
    ],
    execute: async (ctx) => {
      const item = (ctx.interaction ? ctx.interaction.options.getString('item', true) : ctx.args.join(' ')) || '';
      if (!item) return ctx.replyError('Missing Item', 'Specify which item you wish to purchase.');

      const res = EconomyService.buyItem(ctx.user.id, item);
      if (res.success) return ctx.replySuccess('Item Purchased', res.message);
      return ctx.replyError('Purchase Incomplete', res.message);
    },
  },
  {
    name: 'inventory',
    description: 'Inspect your purchased store inventory and assets',
    category: 'Economy',
    aliases: ['inv', 'bag', 'myitems', 'storage'],
    execute: async (ctx) => {
      const inv = EconomyService.getInventory(ctx.user.id);
      if (inv.length === 0) return ctx.replyInfo('Personal Inventory', 'Your backpack is currently empty. Visit `&shop` to acquire items.');

      return ctx.replyInfo('Personal Inventory', inv.map(i => `• **${i}**`).join('\n'));
    },
  },
  {
    name: 'addmoney',
    description: 'Grant credits to a user (Admin only)',
    category: 'Economy',
    aliases: ['givecash', 'ecoadd', 'adminmoney'],
    permissions: [PermissionsBitField.Flags.Administrator],
    slashOptions: [
      { name: 'user', description: 'Target user', type: ApplicationCommandOptionType.User, required: true },
      { name: 'amount', description: 'Credits amount', type: ApplicationCommandOptionType.Integer, required: true },
    ],
    execute: async (ctx) => {
      const user = ctx.interaction ? ctx.interaction.options.getUser('user', true) : ctx.message?.mentions.users.first();
      const amount = ctx.interaction ? ctx.interaction.options.getInteger('amount', true) : parseInt(ctx.args[1] || '0');

      if (!user || isNaN(amount) || amount <= 0) return ctx.replyError('Invalid Arguments', 'Usage: `&addmoney @user <amount>`');
      EconomyService.addMoney(user.id, amount);
      return ctx.replySuccess('Credits Granted', `Added **$${amount.toLocaleString()}** to <@${user.id}>'s wallet.`);
    },
  },
];
