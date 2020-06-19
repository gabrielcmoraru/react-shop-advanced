const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { promisify } = require('util');
const { transport, makeANiceEmail } = require('../mail');
const { hasPermission } = require('../utils');
const stripe = require('../stripe');

const Mutations = {
    async createItem(parent, args, ctx, info) {
        if (!ctx.request.userId) {
            throw new Error('You must be logged in to do that!');
        }

        const item = await ctx.db.mutation.createItem(
            {
                data: {
                    // This is how to create relationship between the Item and User
                    user: {
                        connect: {
                            id: ctx.request.userId,
                        },
                    },
                    ...args,
                },
            },
            info
        );

        return item;
    },

    updateItem(parent, args, ctx, info) {
        // first take a copy of the updates
        const updates = { ...args };
        // remove the ID from the updates
        delete updates.id;
        // run the update method
        return ctx.db.mutation.updateItem(
            {
                data: updates,
                where: {
                    id: args.id,
                },
            },
            info
        );
    },

    async deleteItem(parent, args, ctx, info) {
        const where = { id: args.id };
        // 1.find item
        const item = await ctx.db.query.item(
            { where },
            `{id title user { id }}`
        );
        // 2.check if the own that item/have permissions
        const ownsItem = item.user.id === ctx.request.userId;
        const hasPermissions = ctx.request.user.permissions.some((permission) =>
            ['ADMIN', 'ITEMDELETE'].includes(permission)
        );

        if (!ownsItem || !hasPermissions) {
            throw new Error("You don't have permission to do that");
        }
        // 3.delete it!
        return ctx.db.mutation.deleteItem({ where }, info);
    },

    async signup(parent, args, ctx, info) {
        // lowercase their emails
        args.email = args.email.toLowerCase();
        // hash password
        const password = await bcrypt.hash(args.password, 10);
        // TODO Permission HACK in use at the moment check when apollo allows updating this from the system
        let tempPermission;
        if (args.email == 'bob1@bob1.com') {
            tempPermission = 'ADMIN';
        } else {
            tempPermission = 'USER';
        }
        // create user in db
        const user = await ctx.db.mutation.createUser(
            {
                data: {
                    ...args,
                    password,
                    permissions: { set: [tempPermission] },
                },
            },
            info
        );
        // create JWT token for user
        const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
        // set the JWL as a cookie on the response
        ctx.response.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
        });
        // return user to the browser FINALLY!
        return user;
    },

    async signin(parent, { email, password }, ctx, info) {
        // 1. check if there is a user with that email
        const user = await ctx.db.query.user({ where: { email } });
        if (!user) {
            throw new Error(`No such user found for email ${email}`);
        }
        // 2. check if their password is correct
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            throw new Error('Invalid password!');
        }
        // 3. generate the JWT token
        const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
        // 4. set the cookie with the token
        ctx.response.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
        });
        // 5. return the user
        return user;
    },

    signout(parent, args, ctx, info) {
        ctx.response.clearCookie('token');
        return { message: 'Goodbye!' };
    },

    async requestReset(parent, args, ctx, info) {
        // 1. Check if this is a real user
        const user = await ctx.db.query.user({ where: { email: args.email } });
        if (!user) {
            throw new Error(`No such user found for email ${args.email}`);
        }
        // 2. Set a reset token and expiry on that user
        const resetToken = (await promisify(randomBytes)(20)).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now
        const res = await ctx.db.mutation.updateUser({
            where: { email: args.email },
            data: { resetToken, resetTokenExpiry },
        });
        // 3. Email them that reset token
        const mailRes = await transport.sendMail({
            from: 'bob@bob.com',
            to: user.email,
            subject: 'Your password link',
            html: makeANiceEmail(`Your Password Reset Link Is Here!
            \n\n <a href="${
                process.env.FRONTEND_URL
            }/reset?resetToken=${resetToken}">Click here to reset</a>`),
        });

        // 4. Return the message
        return { message: 'Thank you for ur request' };
    },

    async resetPassword(parent, args, ctx, info) {
        // 1. check if passwords match
        if (args.password !== args.confirmPassword) {
            throw new Error('Yo Passwords don`t match!');
        }
        // 2. check if its a legit reset token
        // 3. check if its not expired(token)
        const [user] = await ctx.db.query.users({
            where: {
                resetToken: args.resetToken,
                resetTokenExpiry_gte: Date.now() - 3600000,
            },
        });
        if (!user) {
            throw new Error('This token is either invalid or expired!');
        }
        // 4. hash the new password
        const password = await bcrypt.hash(args.password, 10);
        // 5. save the new password to the user and empty resetToken fields
        const updatedUser = await ctx.db.mutation.updateUser({
            where: { email: user.email },
            data: {
                password,
                resetToken: null,
                resetTokenExpiry: null,
            },
        });
        // 6. generate JWT
        const token = jwt.sign(
            { userId: updatedUser.id },
            process.env.APP_SECRET
        );
        // 7. set the JWT cookie
        ctx.response.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
        });
        // 8. return the new user
        return updatedUser;
    },

    async updatePermissions(parent, args, ctx, info) {
        // 1. check if they are logged in
        if (!ctx.request.userId) {
            throw new Error('You must be logged in!');
        }
        // 2. query the current user
        const currentUser = await ctx.db.query.user(
            {
                where: {
                    id: ctx.request.userId,
                },
            },
            info
        );
        // 3. check if they got the permissions for this
        hasPermission(currentUser, ['ADMIN', 'PERMISSIONUPDATE']);
        // 4. update the permissions
        return ctx.db.mutation.updateUser(
            {
                data: {
                    permissions: {
                        set: args.permissions,
                    },
                },
                where: {
                    id: args.userId,
                },
            },
            info
        );
    },

    async addToCart(parent, args, ctx, info) {
        // 1. make sure they are signed in
        const { userId } = ctx.request;
        if (!userId) {
            throw new Error('You must be signed in sooon!');
        }
        // 2. query the user current cart
        const [existingCartItem] = await ctx.db.query.cartItems({
            where: {
                user: { id: userId },
                item: { id: args.id },
            },
        });
        // 3. check if that item is already in the cart and increment value if it is
        if (existingCartItem) {
            console.log('This item is already in the cart');
            return ctx.db.mutation.updateCartItem(
                {
                    where: { id: existingCartItem.id },
                    data: { quantity: existingCartItem.quantity + 1 },
                },
                info
            );
        }
        // 4. if not, create a fresh CartItem fo that user
        return ctx.db.mutation.createCartItem(
            {
                data: {
                    user: {
                        connect: { id: userId },
                    },
                    item: {
                        connect: { id: args.id },
                    },
                },
            },
            info
        );
    },

    async removeFromCart(parent, args, ctx, info) {
        // 1. find cart item
        const cartItem = await ctx.db.query.cartItem(
            {
                where: {
                    id: args.id,
                },
            },
            `{id, user {id}}`
        );
        // 1.5 Make sure we found an item
        if (!cartItem) throw new Error('No CartItem Found!');
        // 2. own that cart item?
        if (cartItem.user.id !== ctx.request.userId) {
            throw new Error('Cheatin huhhh');
        }
        // 3. delete that cart item
        return ctx.db.mutation.deleteCartItem(
            {
                where: { id: args.id },
            },
            info
        );
    },

    async createOrder(parent, args, ctx, info) {
        // 1. query current user and make sure they are signed in
        const { userId } = ctx.request;
        if (!userId)
            throw new Error('You must be signed in to complete this order');

        const user = await ctx.db.query.user(
            {
                where: { id: userId },
            },
            `{
            id
            name
            email
            cart {
                id
                quantity
                item {
                    title
                    price
                    id
                    description
                    image
                    largeImage
                }
            }
        }`
        );
        // 2. recalculate the total price
        const amount = user.cart.reduce(
            (tally, cartItem) =>
                tally + cartItem.item.price * cartItem.quantity,
            0
        );
        console.log(`going to charge for ${amount}`);
        // 3. create stripe charge (token to cash)
        const charge = await stripe.charges.create({
            amount,
            currency: 'USD',
            source: args.token,
        });
        // 4. convert cartItems to orderItems
        const orderItems = user.cart.map((cartItem) => {
            const orderItem = {
                ...cartItem.item,
                quantity: cartItem.quantity,
                user: {
                    connect: { id: userId },
                },
            };
            delete orderItem.id;
            return orderItem;
        });
        // 5. create the order
        const order = await ctx.db.mutation.createOrder({
            data: {
                total: charge.amount,
                charge: charge.id,
                items: { create: orderItems },
                user: { connect: { id: userId } },
            },
        });
        // 6. clean up - clear the users cart, delete cartItems
        const cartItemIds = user.cart.map((cartItem) => cartItem.id);
        await ctx.db.mutation.deleteManyCartItems({
            where: { id_in: cartItemIds },
        });
        // 7. return the order to the client
        return order;
    },
};

module.exports = Mutations;
