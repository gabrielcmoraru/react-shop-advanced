import React, { Component } from 'react';
import Header from './Header';
import Meta from '../components/Meta';

export default class Page extends Component {
    render() {
        return (
            <div>
                <Meta />
                <Header />
                <p>I'm the page Component</p>
                {this.props.children}
            </div>
        );
    }
}
