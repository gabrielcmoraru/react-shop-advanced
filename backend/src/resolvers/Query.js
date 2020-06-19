const { forwardTo } = require('prisma-binding');
const { hasPermission } = require('../utils');

const Query = {
    items: forwardTo('db'),
    item: forwardTo('db'),
    itemsConnection: forwardTo('db'),
    me(parent, args, ctx, info) {
        // check if there is a current user ID
        if (!ctx.request.userId) {
            return null;
        }

        return ctx.db.query.user(
            {
                where: { id: ctx.request.userId },
            },
            info
        );
    },

    async users(parent, args, ctx, info) {
        // 1. check if their logged in
        if (!ctx.request.userId) {
            throw new Error('You must be logged in!');
        }
        // 2. check if user has permissions to query all users
        hasPermission(ctx.request.user, ['ADMIN', 'PERMISSIONUPDATE']);
        // 3. if they do, query all the users
        return ctx.db.query.users({}, info);
    },

    async order(parent, args, ctx, info) {
        //1. make sure the are logged in
        if (!ctx.request.userId) {
            throw new Error('You arent logged in!');
        }
        //2. query the current order
        const order = await ctx.db.query.order(
            {
                where: {
                    id: args.id,
                },
            },
            info
        );
        //3. check if they have the permission to see this order
        const ownsOrder = order.user.id === ctx.request.userId;
        const hasPermission = ctx.request.user.permissions.includes('ADMIN');
        if (!ownsOrder || !hasPermission) {
            throw new Error('You cant see this ! ');
        }
        //4. return the order
        return order;
    },
};

module.exports = Query;
