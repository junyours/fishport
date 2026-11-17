<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login');

Route::get('/hostinger-cron/schedule-run', function (Request $request) {
    $configuredToken = (string) config('services.hostinger_cron.token');
    $requestToken = (string) $request->query('token', '');

    if ($configuredToken === '' || ! hash_equals($configuredToken, $requestToken)) {
        abort(404);
    }

    Artisan::call('schedule:run');

    return response()->json([
        'ok' => true,
        'output' => trim(Artisan::output()),
    ]);
});

$pages = [
    '/home' => ['landing_page/home'],
    '/about' => ['landing_page/about'],
    '/contact' => ['landing_page/contact'],
    '/login' => ['login/user-login', 'login'],
    '/dashboard' => ['rbac/dashboard', 'staff'],
    '/notification' => ['rbac/notifications', 'staff'],
    '/settings' => ['rbac/settings', 'staff'],
    '/registered-boats' => ['rbac/boat-management', 'staff'],
    '/add-boat' => ['rbac/boat-management', 'staff'],
    '/boat-type' => ['rbac/boat-types', 'staff'],
    '/boat-owners' => ['rbac/boat-owners', 'staff'],
    '/docking' => ['rbac/docking', 'staff'],
    '/docking-calendar' => ['rbac/docking', 'staff'],
    '/banyera' => ['rbac/banyera', 'staff'],
    '/fish-classification' => ['rbac/banyera', 'staff'],
    '/vehicle-tickets' => ['rbac/vehicle-tickets', 'staff'],
    '/daily-vehicle-tickets' => ['rbac/vehicle-tickets', 'staff'],
    '/annual-vehicle-tickets' => ['rbac/vehicle-tickets', 'staff'],
    '/vehicle-types' => ['rbac/vehicle-tickets', 'staff'],
    '/billing' => ['rbac/billing', 'staff'],
    '/billing-payments' => ['rbac/billing', 'staff'],
    '/collections' => ['rbac/collection', 'staff'],
    '/reports' => ['rbac/reports', 'staff'],
    '/remittance' => ['rbac/collection', 'staff', 'remittance'],
    '/archives' => ['rbac/archived', 'staff'],
    '/manage-accounts' => ['rbac/manage-accounts', 'staff'],
    '/activity-logs' => ['rbac/activity-logs', 'head'],
    '/set-fees' => ['rbac/set-fees', 'head'],
    '/owner-statement' => ['rbac/statement-of-account', 'staff'],
    '/boat-statement' => ['rbac/statement-of-account', 'staff'],
];

foreach ($pages as $path => $page) {
    Route::inertia($path, $page[0], [
        'access' => $page[1] ?? 'public',
        'initialTab' => $page[2] ?? null,
    ]);
}

// Preserve links from earlier versions of the dashboard.
$aliases = [
    '/create-billing' => '/billing',
    '/payments' => '/collections',
    '/record-payment' => '/billing-payments',
    '/statement-of-account' => '/owner-statement',
    '/admin/dashboard' => '/dashboard',
    '/admin/settings' => '/settings',
    '/admin-settings' => '/settings',
    '/admin_settings' => '/settings',
    '/admin/registered-boats' => '/registered-boats',
    '/admin-registered-boats' => '/registered-boats',
    '/admin_registered_boats' => '/registered-boats',
    '/admin/add-boat' => '/add-boat',
    '/admin-add-boat' => '/add-boat',
    '/admin_add_boat' => '/add-boat',
    '/admin/boat-type' => '/boat-type',
    '/admin-boat-type' => '/boat-type',
    '/admin_boat_type' => '/boat-type',
    '/admin/boat-owners' => '/boat-owners',
    '/admin-boat-owners' => '/boat-owners',
    '/admin_boat_owners' => '/boat-owners',
    '/admin/docking' => '/docking',
    '/admin-docking' => '/docking',
    '/admin_docking' => '/docking',
    '/admin/docking-calendar' => '/docking-calendar',
    '/admin-docking-calendar' => '/docking-calendar',
    '/admin_docking_calendar' => '/docking-calendar',
    '/admin/banyera' => '/banyera',
    '/admin-banyera' => '/banyera',
    '/admin_banyera' => '/banyera',
    '/admin/fish-classification' => '/fish-classification',
    '/admin-fish-classification' => '/fish-classification',
    '/admin_fish_classification' => '/fish-classification',
    '/admin/vehicle-tickets' => '/vehicle-tickets',
    '/admin-vehicle-tickets' => '/vehicle-tickets',
    '/admin_vehicle_tickets' => '/vehicle-tickets',
    '/admin/daily-vehicle-tickets' => '/daily-vehicle-tickets',
    '/admin-daily-vehicle-tickets' => '/daily-vehicle-tickets',
    '/admin_daily_vehicle_tickets' => '/daily-vehicle-tickets',
    '/admin/annual-vehicle-tickets' => '/annual-vehicle-tickets',
    '/admin-annual-vehicle-tickets' => '/annual-vehicle-tickets',
    '/admin_annual_vehicle_tickets' => '/annual-vehicle-tickets',
    '/admin/vehicle-types' => '/vehicle-types',
    '/admin-vehicle-types' => '/vehicle-types',
    '/admin_vehicle_types' => '/vehicle-types',
    '/admin/billing' => '/billing',
    '/admin-billing' => '/billing',
    '/admin_billing' => '/billing',
    '/admin/billing-payments' => '/billing-payments',
    '/admin-billing-payments' => '/billing-payments',
    '/admin_billing_payments' => '/billing-payments',
    '/admin/create-billing' => '/billing',
    '/admin-create-billing' => '/billing',
    '/admin_create_billing' => '/billing',
    '/admin/payments' => '/collections',
    '/admin-payments' => '/collections',
    '/admin_payments' => '/collections',
    '/admin/record-payment' => '/billing-payments',
    '/admin-record-payment' => '/billing-payments',
    '/admin_record_payment' => '/billing-payments',
    '/admin/owner-statement' => '/owner-statement',
    '/admin/boat-statement' => '/boat-statement',
    '/admin/statement-of-account' => '/owner-statement',
    '/admin-statement-of-account' => '/owner-statement',
    '/admin_statement_of_account' => '/owner-statement',
    '/admin/reports' => '/reports',
    '/admin-reports' => '/reports',
    '/admin_reports' => '/reports',
    '/admin/remittance' => '/remittance',
    '/admin-remittance' => '/remittance',
    '/admin_remittance' => '/remittance',
    '/admin/archives' => '/archives',
    '/admin-archives' => '/archives',
    '/admin_archives' => '/archives',
    '/super-dashboard' => '/dashboard',
    '/superdashboard' => '/dashboard',
    '/super_dashboard' => '/dashboard',
    '/super-registered-boats' => '/registered-boats',
    '/super_registeredboats' => '/registered-boats',
    '/superregisteredboats' => '/registered-boats',
    '/super-add-boat' => '/add-boat',
    '/super_addboat' => '/add-boat',
    '/super-add-boat-type' => '/boat-type',
    '/super_addboattype' => '/boat-type',
    '/super-boat-owners' => '/boat-owners',
    '/super_boatowners' => '/boat-owners',
    '/super-docking' => '/docking',
    '/super_docking' => '/docking',
    '/super-docking-calendar' => '/docking-calendar',
    '/super_docking_calendar' => '/docking-calendar',
    '/super-banyera' => '/banyera',
    '/super_banyera' => '/banyera',
    '/super-fish-classification' => '/fish-classification',
    '/super_fish_classification' => '/fish-classification',
    '/super-vehicle-tickets' => '/vehicle-tickets',
    '/super_vehicle_tickets' => '/vehicle-tickets',
    '/super-daily-vehicle-tickets' => '/daily-vehicle-tickets',
    '/super_daily_vehicle_tickets' => '/daily-vehicle-tickets',
    '/super-annual-vehicle-tickets' => '/annual-vehicle-tickets',
    '/super_annual_vehicle_tickets' => '/annual-vehicle-tickets',
    '/super-vehicle-types' => '/vehicle-types',
    '/super_vehicle_types' => '/vehicle-types',
    '/super-billing' => '/billing',
    '/super_billing' => '/billing',
    '/super-billing-payments' => '/billing-payments',
    '/super_billing_payments' => '/billing-payments',
    '/super-create-billing' => '/billing',
    '/super_create_billing' => '/billing',
    '/super-payments' => '/collections',
    '/super_payments' => '/collections',
    '/super-record-payment' => '/billing-payments',
    '/super_record_payment' => '/billing-payments',
    '/super-owner-statement' => '/owner-statement',
    '/super-boat-statement' => '/boat-statement',
    '/super-statement-of-account' => '/owner-statement',
    '/super_statement_of_account' => '/owner-statement',
    '/super-reports' => '/reports',
    '/super_reports' => '/reports',
    '/super-remittance' => '/remittance',
    '/super-archived' => '/archives',
    '/super-admin/archives' => '/archives',
    '/super_admin/archives' => '/archives',
    '/super-admin-archives' => '/archives',
    '/super_archives' => '/archives',
    '/super-manage-accounts' => '/manage-accounts',
    '/super_manageaccounts' => '/manage-accounts',
    '/super-activity-logs' => '/activity-logs',
    '/super_activitylogs' => '/activity-logs',
    '/super-set-fees' => '/set-fees',
    '/super_setfees' => '/set-fees',
    '/super-settings' => '/settings',
    '/super_settings' => '/settings',
];

$aliasesWithSearch = ['/record-payment', '/admin/record-payment', '/admin-record-payment', '/admin_record_payment', '/super-record-payment', '/super_record_payment'];

Route::get('{path}', function (Request $request, string $path) use ($aliases, $aliasesWithSearch) {
    $path = '/'.strtolower($path);
    $target = $aliases[$path] ?? '/login';
    $query = in_array($path, $aliasesWithSearch, true) ? $request->getQueryString() : null;

    return redirect($query ? $target.'?'.$query : $target);
})->where('path', '(?!(?:api|storage|build|sanctum)(?:/|$)).*');
