import type { Schema, Struct } from '@strapi/strapi';

export interface GlobalFooter extends Struct.ComponentSchema {
  collectionName: 'components_global_footers';
  info: {
    displayName: 'Footer';
    icon: 'bulletList';
  };
  attributes: {
    copyright: Schema.Attribute.String;
    description: Schema.Attribute.RichText;
    internal_links: Schema.Attribute.Component<'shared.link', true>;
    social_media_links: Schema.Attribute.Component<'shared.link', true>;
  };
}

export interface GlobalNavbar extends Struct.ComponentSchema {
  collectionName: 'components_global_navbars';
  info: {
    displayName: 'Navbar';
    icon: 'bulletList';
  };
  attributes: {
    left_navbar_items: Schema.Attribute.Component<'shared.link', true>;
    logo: Schema.Attribute.Relation<'oneToOne', 'api::logo.logo'>;
  };
}

export interface SharedLink extends Struct.ComponentSchema {
  collectionName: 'components_shared_links';
  info: {
    displayName: 'Link';
    icon: 'link';
  };
  attributes: {
    target: Schema.Attribute.Enumeration<
      ['_blank', '_self', '_parent', '_top']
    >;
    text: Schema.Attribute.String;
    URL: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'global.footer': GlobalFooter;
      'global.navbar': GlobalNavbar;
      'shared.link': SharedLink;
    }
  }
}
