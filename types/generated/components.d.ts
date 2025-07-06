import type { Schema, Struct } from '@strapi/strapi';

export interface DynamicZoneActivity extends Struct.ComponentSchema {
  collectionName: 'components_dynamic_zone_activities';
  info: {
    displayName: 'Activity';
  };
  attributes: {
    contactPerson: Schema.Attribute.String;
    content: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface DynamicZoneActivityCategory extends Struct.ComponentSchema {
  collectionName: 'components_dynamic_zone_activity_categories';
  info: {
    displayName: 'ActivityCategory';
  };
  attributes: {
    Activities: Schema.Attribute.Component<'dynamic-zone.activity', true>;
    content: Schema.Attribute.Text;
    image: Schema.Attribute.Media<'images', true>;
    title: Schema.Attribute.String;
    url: Schema.Attribute.String;
  };
}

export interface DynamicZoneHero extends Struct.ComponentSchema {
  collectionName: 'components_dynamic_zone_heroes';
  info: {
    displayName: 'Hero';
  };
  attributes: {
    headline: Schema.Attribute.String;
    image: Schema.Attribute.Media<'images'>;
    link: Schema.Attribute.Component<'shared.link', true>;
    subHeadline: Schema.Attribute.Text;
  };
}

export interface DynamicZoneHistories extends Struct.ComponentSchema {
  collectionName: 'components_dynamic_zone_histories';
  info: {
    displayName: 'Histories';
  };
  attributes: {
    content: Schema.Attribute.Text;
    historyLine: Schema.Attribute.Component<'dynamic-zone.history-line', true>;
    title: Schema.Attribute.String;
  };
}

export interface DynamicZoneHistoryLine extends Struct.ComponentSchema {
  collectionName: 'components_dynamic_zone_history_lines';
  info: {
    displayName: 'HistoryLine';
  };
  attributes: {
    content: Schema.Attribute.Text;
    headline: Schema.Attribute.String;
    image: Schema.Attribute.Media<'images'>;
    year: Schema.Attribute.String;
  };
}

export interface DynamicZoneTestimonials extends Struct.ComponentSchema {
  collectionName: 'components_dynamic_zone_testimonials';
  info: {
    displayName: 'Testimonials';
  };
  attributes: {
    description: Schema.Attribute.String;
    title: Schema.Attribute.String;
    youtube: Schema.Attribute.Component<'shared.link', true>;
  };
}

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
    url: Schema.Attribute.String;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    displayName: 'Seo';
  };
  attributes: {
    canonicalURL: Schema.Attribute.String;
    keywords: Schema.Attribute.Text;
    metaDescription: Schema.Attribute.String;
    metaRobots: Schema.Attribute.String;
    metaTitle: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'dynamic-zone.activity': DynamicZoneActivity;
      'dynamic-zone.activity-category': DynamicZoneActivityCategory;
      'dynamic-zone.hero': DynamicZoneHero;
      'dynamic-zone.histories': DynamicZoneHistories;
      'dynamic-zone.history-line': DynamicZoneHistoryLine;
      'dynamic-zone.testimonials': DynamicZoneTestimonials;
      'global.footer': GlobalFooter;
      'global.navbar': GlobalNavbar;
      'shared.link': SharedLink;
      'shared.seo': SharedSeo;
    }
  }
}
