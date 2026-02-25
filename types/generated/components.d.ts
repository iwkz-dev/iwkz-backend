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

export interface DynamicZoneActivityCategorySection
  extends Struct.ComponentSchema {
  collectionName: 'components_dynamic_zone_activity_category_sections';
  info: {
    displayName: 'ActivityCategorySection';
  };
  attributes: {
    ActivityCategory: Schema.Attribute.Component<
      'dynamic-zone.activity-category',
      true
    >;
    headline: Schema.Attribute.String;
    subHeadline: Schema.Attribute.String;
  };
}

export interface DynamicZoneBankTransfer extends Struct.ComponentSchema {
  collectionName: 'components_dynamic_zone_bank_transfers';
  info: {
    displayName: 'BankTransfer';
  };
  attributes: {
    bankName: Schema.Attribute.String;
    bic: Schema.Attribute.String;
    iban: Schema.Attribute.String;
  };
}

export interface DynamicZoneDonationPackage extends Struct.ComponentSchema {
  collectionName: 'components_dynamic_zone_donation_packages';
  info: {
    displayName: 'DonationPackage';
  };
  attributes: {
    description: Schema.Attribute.RichText;
    donationItems: Schema.Attribute.Component<
      'dynamic-zone.donation-sub-package',
      true
    >;
    endDate: Schema.Attribute.Date;
    image: Schema.Attribute.Media<'files' | 'images'>;
    published: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface DynamicZoneDonationSubPackage extends Struct.ComponentSchema {
  collectionName: 'components_dynamic_zone_donation_sub_packages';
  info: {
    displayName: 'DonationItem';
  };
  attributes: {
    price: Schema.Attribute.Decimal & Schema.Attribute.Required;
    requireDonatorInfo: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    targetDonation: Schema.Attribute.Decimal;
    title: Schema.Attribute.String;
    uniqueCode: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
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
    displayName: 'HistoriesSection';
  };
  attributes: {
    headline: Schema.Attribute.String;
    historyLine: Schema.Attribute.Component<'dynamic-zone.history-line', true>;
    subHeadline: Schema.Attribute.Text;
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

export interface DynamicZonePaypalConfig extends Struct.ComponentSchema {
  collectionName: 'components_dynamic_zone_paypal_configs';
  info: {
    displayName: 'PaypalConfig';
  };
  attributes: {
    cancelUrl: Schema.Attribute.String;
    fixFee: Schema.Attribute.Decimal;
    percentageFee: Schema.Attribute.Decimal;
    returnUrl: Schema.Attribute.String;
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
      'dynamic-zone.activity-category-section': DynamicZoneActivityCategorySection;
      'dynamic-zone.bank-transfer': DynamicZoneBankTransfer;
      'dynamic-zone.donation-package': DynamicZoneDonationPackage;
      'dynamic-zone.donation-sub-package': DynamicZoneDonationSubPackage;
      'dynamic-zone.hero': DynamicZoneHero;
      'dynamic-zone.histories': DynamicZoneHistories;
      'dynamic-zone.history-line': DynamicZoneHistoryLine;
      'dynamic-zone.paypal-config': DynamicZonePaypalConfig;
      'dynamic-zone.testimonials': DynamicZoneTestimonials;
      'global.footer': GlobalFooter;
      'global.navbar': GlobalNavbar;
      'shared.link': SharedLink;
      'shared.seo': SharedSeo;
    }
  }
}
