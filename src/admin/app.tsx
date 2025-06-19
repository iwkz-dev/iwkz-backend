import type { StrapiApp } from '@strapi/strapi/admin';
import logo from './img/iwkz.png';

export default {
    config: {
        auth: { logo },
        head: { favicon: logo },
        menu: { logo },
        translations: {
            en: {
                'app.components.LeftMenu.navbrand.title': 'IWKZ Backend',
                'Auth.form.welcome.title': 'IWKZ Backend',
                'Auth.form.welcome.subtitle': 'Silakan Login...',
            },
        },
    },
    bootstrap(app: StrapiApp) {
        console.log(app);
    },
};
