# Fish Port web app

Laravel and the React frontend live in this folder. Laravel serves React screen routes through Inertia. The web and mobile clients continue to use the existing JSON API at /api.

## Local development

From a full checkout, enter the web folder. The React build imports the shared translation catalog from the sibling mobile folder.

Install Composer and npm dependencies, copy .env.example to .env, and configure MySQL. Generate APP_KEY for a new local environment. Use a fresh database when you want only the seeded head account.

```sh
composer install
npm ci
php artisan key:generate
php artisan migrate --seed
```

Run php artisan serve and npm run dev in separate terminals, then open the URL printed by Artisan. For a production build, run npm run build. Vite writes the frontend assets and manifest to public/build.

## Hostinger Cloud

Build from the full checkout, then upload the web folder, including public/build, beside the existing public_html folder. From web on Hostinger, run `composer2 install --no-dev --optimize-autoloader`. In `web/.env`, set `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` to the HTTPS URL, and configure the MySQL connection. Keep the existing `APP_KEY` when moving an existing installation. Generate a key with `php artisan key:generate` for a fresh installation.

Run `php artisan migrate --force` for an existing database or `php artisan migrate --seed --force` on a fresh database to add the head account. Set a unique password for that account before opening the site to users.

```text
domains/your-domain.com/
├── web/
│   ├── .env
│   ├── artisan
│   ├── vendor/
│   └── public/
│       └── build/
└── public_html/
    ├── .htaccess
    ├── index.php
    ├── build/
    ├── images/
    └── storage
```

Copy the contents of web/public into public_html, including .htaccess. Keep the copy of public/build in web because Laravel reads the manifest there. The public index.php loads Laravel from the sibling web folder when served from public_html. Configure the public storage link to point to ../web/storage/app/public.

For an update limited to React or CSS, run npm run build and publish the resulting build directory to both web/public/build and public_html/build. If Hostinger is configured to serve symlinks, public_html/build can link to ../web/public/build so you publish the build in one place. Keep VITE_API_BASE_URL=/api in the build environment.

After publishing, check /up, /login, and a direct dashboard link. Configure the existing Laravel scheduler on the host for jobs such as backups and billing penalties.
