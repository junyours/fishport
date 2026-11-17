<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $needsUrl = !Schema::hasColumn('payments', 'official_receipt_image_url');
        $needsPublicId = !Schema::hasColumn('payments', 'official_receipt_image_public_id');

        if (!$needsUrl && !$needsPublicId) {
            return;
        }

        Schema::table('payments', function (Blueprint $table) use ($needsUrl, $needsPublicId) {
            if ($needsUrl) {
                $table->text('official_receipt_image_url')->nullable();
            }

            if ($needsPublicId) {
                $table->string('official_receipt_image_public_id')->nullable();
            }
        });
    }

    public function down(): void
    {
        // Earlier installations may already have these columns and saved receipts.
        // Retain the receipt links when rolling back the migration record.
    }
};
