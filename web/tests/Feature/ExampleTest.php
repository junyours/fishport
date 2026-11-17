<?php

namespace Tests\Feature;

use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Http\Request;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    public function test_the_homepage_redirects_to_the_inertia_login_screen(): void
    {
        $this->withoutVite();

        $this->get('/')->assertRedirect('/login');
        $this->get('/login')->assertOk()->assertSee('data-page', false);
    }

    public function test_inertia_resolves_dashboard_routes_and_preserves_legacy_bill_links(): void
    {
        $version = app(HandleInertiaRequests::class)->version(Request::create('/docking-calendar'));

        $this->get('/docking-calendar', [
            'X-Inertia' => 'true',
            'X-Inertia-Version' => $version ?? '',
        ])->assertOk()
            ->assertHeader('X-Inertia', 'true')
            ->assertJsonPath('component', 'rbac/docking')
            ->assertJsonPath('props.access', 'staff');

        $this->get('/admin/record-payment?bill=42')->assertRedirect('/billing-payments?bill=42');
        $this->getJson('/api/missing-endpoint')->assertNotFound();
    }
}
