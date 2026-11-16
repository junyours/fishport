<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::firstOrCreate([
            'email' => 'headofmeeo.opol@gmail.com',
        ], [
            'password' => Hash::make('password123'),
            'role' => 'head',
            'status' => 'offline',
            'first_name' => 'Jhunie',
            'last_name' => 'Mercado',
        ]);
    }
}
