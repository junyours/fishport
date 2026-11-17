<?php

// Run through artisan tinker. Existing payments remain unchanged; no migration.
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

foreach (['official_receipt_image_url', 'official_receipt_image_public_id'] as $column) {
    if (!Schema::hasColumn('payments', $column)) {
        Schema::table('payments', function (Blueprint $table) use ($column) {
            $column === 'official_receipt_image_url'
                ? $table->text($column)->nullable()
                : $table->string($column)->nullable();
        });
    }
}

echo "Payment OR image columns are ready.\n";
