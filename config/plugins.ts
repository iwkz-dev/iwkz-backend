export default ({ env }) => ({
    upload: {
        config: {
            provider: 'cloudinary',
            providerOptions: {
                cloud_name: env('CLOUDINARY_NAME'),
                api_key: env('CLOUDINARY_KEY'),
                api_secret: env('CLOUDINARY_SECRET'),
            },
            actionOptions: {
                upload: {},
                uploadStream: {},
                delete: {},
            },
        },
    },
    email: {
        config: {
            provider: 'nodemailer',
            providerOptions: {
                host: env('NODEMAILER_GMAIL_HOST'),
                port: env('NODEMAILER_GMAIL_PORT'),
                secure: env('NODEMAILER_GMAIL_SECURE'),
                auth: {
                    type: 'OAuth2',
                    user: env('NODEMAILER_GMAIL_OAUTH_USER'),
                    clientId: env('NODEMAILER_GMAIL_OAUTH_CLIENT_ID'),
                    clientSecret: env('NODEMAILER_GMAIL_OAUTH_CLIENT_SECRET'),
                    refreshToken: env('NODEMAILER_GMAIL_OAUTH_REFRESH_TOKEN'),
                },
            },
            settings: {
                defaultFrom: `IWKZ Admin <${env('NODEMAILER_GMAIL_OAUTH_USER')}>`,
                defaultReplyTo: env('NODEMAILER_GMAIL_OAUTH_USER'),
            },
        },
    },
});
