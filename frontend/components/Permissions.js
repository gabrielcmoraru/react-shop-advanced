import { Query } from 'react-apollo';
import Error from './ErrorMessage';
import gql from 'graphql-tag';
import Table from './styles/Table';
import SickButton from './styles/SickButton';
const possilePermissions = [
    'ADMIN',
    'USER',
    'ITEMCREATE',
    'ITEMUPDATE',
    'ITEMDELETE',
    'PERMISSIONUPDATE',
];

const ALL_USERS_QUERY = gql`
    query {
        users {
            id
            name
            email
            permissions
        }
    }
`;

const Permissions = (props) => (
    <Query query={ALL_USERS_QUERY}>
        {({ data, loading, error }) => (
            <div>
                <Error error={error} />
                <div>
                    <h2>Manage Permissions</h2>
                    <Table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                {possilePermissions.map((permission) => (
                                    <th>{permission}</th>
                                ))}
                                <th>👇</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.users.map((user) => (
                                <User user={user} />
                            ))}
                        </tbody>
                    </Table>
                </div>
            </div>
        )}
    </Query>
);

class User extends React.Component {
    render() {
        const user = this.props.user;
        return (
            <tr>
                <td>{user.name}</td>
                <td>{user.email}</td>
                {possilePermissions.map((permission) => (
                    <td>
                        <label htmlFor={`${user.id}-permission-${permission}`}>
                            <input type='checkbox' name='' id='' />
                        </label>
                    </td>
                ))}
                <td>
                    <SickButton>UPDATE</SickButton>
                </td>
            </tr>
        );
    }
}

export default Permissions;
