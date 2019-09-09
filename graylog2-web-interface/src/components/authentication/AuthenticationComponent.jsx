import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import { Alert, Nav, NavItem, Row, Col } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import Routes from 'routing/Routes';
import { Spinner } from 'components/common';
import { PluginStore } from 'graylog-web-plugin/plugin';

import PermissionsMixin from 'util/PermissionsMixin';

import ActionsProvider from 'injection/ActionsProvider';

import StoreProvider from 'injection/StoreProvider';
import AuthProvidersConfig from './AuthProvidersConfig';

// eslint-disable-next-line import/no-webpack-loader-syntax
import AuthenticationComponentStyle from '!style!css!./AuthenticationComponent.css';

const AuthenticationActions = ActionsProvider.getActions('Authentication');
const AuthenticationStore = StoreProvider.getStore('Authentication');
const CurrentUserStore = StoreProvider.getStore('CurrentUser');

const AuthenticationComponent = createReactClass({
  displayName: 'AuthenticationComponent',

  propTypes: {
    params: PropTypes.object.isRequired,
    children: PropTypes.element,
  },

  mixins: [Reflux.connect(AuthenticationStore), Reflux.connect(CurrentUserStore), PermissionsMixin],

  getDefaultProps() {
    return {
      children: null,
    };
  },

  componentDidMount() {
    AuthenticationActions.load();

    PluginStore.exports('authenticatorConfigurations').forEach((authConfig) => {
      this.authenticatorConfigurations[authConfig.name] = authConfig;
      // TODO load per authenticator config
    });
  },

  // contains the 'authname' -> plugin descriptor
  authenticatorConfigurations: {},

  _pluginPane() {
    const { params } = this.props;
    const auth = this.authenticatorConfigurations[params.name];

    if (auth) {
      return React.createElement(auth.component, {
        key: `auth-configuration-${params.name}`,
      });
    }
    return (<Alert bsStyle="danger">Plugin component missing for authenticator <code>{params.name}</code>, this is an error.</Alert>);
  },

  _onUpdateProviders(config) {
    return AuthenticationActions.update('providers', config);
  },

  _contentComponent() {
    const { authenticators } = this.state;
    const { params } = this.props;

    if (!authenticators) {
      return <Spinner />;
    }
    if (params.name === undefined) {
      return (
        <AuthProvidersConfig config={authenticators}
                             descriptors={this.authenticatorConfigurations}
                             updateConfig={this._onUpdateProviders} />
      );
    }
    return this._pluginPane();
  },

  render() {
    const { authenticators: auths, currentUser } = this.state;
    const { children } = this.props;
    let authenticators = [];

    if (auths) {
      // only show the entries if the user is permitted to change them, makes no sense otherwise
      if (this.isPermitted(currentUser.permissions, ['authentication:edit'])) {
        authenticators = auths.realm_order.map((name, idx) => {
          const auth = this.authenticatorConfigurations[name];
          const title = (auth || { displayName: name }).displayName;
          const numberedTitle = `${idx + 1}. ${title}`;
          return (
            <LinkContainer key={`container-${name}`} to={Routes.SYSTEM.AUTHENTICATION.PROVIDERS.provider(name)}>
              <NavItem key={name} title={numberedTitle}>{numberedTitle}</NavItem>
            </LinkContainer>
          );
        });

        authenticators.unshift(
          <NavItem key="divider" disabled title="Provider Settings" className={AuthenticationComponentStyle.divider}>Provider Settings</NavItem>,
        );
        authenticators.unshift(
          <LinkContainer key="container-settings" to={Routes.SYSTEM.AUTHENTICATION.PROVIDERS.CONFIG}>
            <NavItem key="settings" title="Configure Provider Order">Configure Provider Order</NavItem>
          </LinkContainer>,
        );
      }
    } else {
      authenticators = [<NavItem key="loading" disabled title="Loading...">Loading...</NavItem>];
    }

    // add submenu items based on permissions
    if (this.isPermitted(currentUser.permissions, ['roles:read'])) {
      authenticators.unshift(
        <LinkContainer key="roles" to={Routes.SYSTEM.AUTHENTICATION.ROLES}>
          <NavItem title="Roles">Roles</NavItem>
        </LinkContainer>,
      );
    }
    if (this.isPermitted(currentUser.permissions, ['users:list'])) {
      authenticators.unshift(
        <LinkContainer key="users" to={Routes.SYSTEM.AUTHENTICATION.USERS.LIST}>
          <NavItem title="Users">Users</NavItem>
        </LinkContainer>,
      );
    }

    if (authenticators.length === 0) {
      // special case, this is a user editing their own profile
      authenticators = [
        <LinkContainer key="profile-edit" to={Routes.SYSTEM.AUTHENTICATION.USERS.edit(encodeURIComponent(currentUser.username))}>
          <NavItem title="Edit Profile">Edit Profile</NavItem>
        </LinkContainer>,
        <LinkContainer key="profile-edit-tokens" to={Routes.SYSTEM.AUTHENTICATION.USERS.TOKENS.edit(encodeURIComponent(currentUser.username))}>
          <NavItem title="Edit Tokens">Edit Tokens</NavItem>
        </LinkContainer>,
      ];
    }
    const subnavigation = (
      <Nav stacked bsStyle="pills">
        {authenticators}
      </Nav>
    );

    const contentComponent = React.Children.count(children) === 1 ? React.Children.only(children) : this._contentComponent();

    return (
      <Row>
        <Col md={2} className={AuthenticationComponentStyle.subnavigation}>{subnavigation}</Col>
        <Col md={10} className={AuthenticationComponentStyle.contentpane}>{contentComponent}</Col>
      </Row>
    );
  },
});

export default AuthenticationComponent;
