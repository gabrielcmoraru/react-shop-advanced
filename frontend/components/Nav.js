import Link from 'next/link';
import { Mutation } from 'react-apollo';
import { TOGGLE_CART_MUTATION } from './Cart';
import NavStyles from './styles/NavStyles';
import User from './User';
import Signout from './Signout';
import CartCount from './CartCount';

const Nav = () => (
    // if (me) return <p>{me.name}</p>;
    //         return null;
    <User>
        {({ data: { me } }) => (
            <NavStyles data-test='nav'>
                <Link href='/items'>
                    <a>Shop</a>
                </Link>
                {me && (
                    <>
                        <Link href='/sell'>
                            <a>Sell</a>
                        </Link>
                        <Link href='/orders'>
                            <a>Orders</a>
                        </Link>
                        <Link href='/me'>
                            <a>Account</a>
                        </Link>
                        <Signout />
                        <Mutation mutation={TOGGLE_CART_MUTATION}>
                            {(toggleCart) => (
                                <button onClick={toggleCart}>
                                    My cart
                                    <CartCount
                                        count={me.cart.reduce(
                                            (tally, cartItem) =>
                                                tally + cartItem.quantity,
                                            0
                                        )}
                                    ></CartCount>
                                </button>
                            )}
                        </Mutation>
                    </>
                )}
                {!me && (
                    <Link href='/signup'>
                        <a>Sign In</a>
                    </Link>
                )}
            </NavStyles>
        )}
    </User>
);

export default Nav;
