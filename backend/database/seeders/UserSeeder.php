<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        User::create([
            'name' => 'John Doe',
            'email' => 'admin@sige.com',
            'email_verified_at' => now(),
            'password' => bcrypt('password'), // Use Hash::make to hash the password
            'remember_token' => null,
        ]);
    }
}
