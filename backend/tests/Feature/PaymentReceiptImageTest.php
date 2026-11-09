<?php

namespace Tests\Feature;

use App\Http\Controllers\PaymentController;
use App\Models\ActivityLog;
use App\Models\Payment;
use App\Services\ActivityLogService;
use App\Services\PaymentReceiptStorage;
use Cloudinary\Cloudinary;
use Cloudinary\Api\ApiResponse;
use Cloudinary\Api\Upload\UploadApi;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Mockery;
use Tests\TestCase;

class PaymentReceiptImageTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['database.default' => 'receipt_testing', 'database.connections.receipt_testing' => [
            'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '',
        ]]);
        foreach ([
            'users' => ['user_id', 'first_name', 'last_name', 'email'],
            'boats' => ['boat_id', 'boat_name', 'owner_id', 'boat_type_id'],
            'boat_owners' => ['owner_id', 'owner_firstname', 'owner_lastname'],
            'boat_types' => ['boat_type_id', 'type_name'],
        ] as $table => $columns) {
            Schema::create($table, function (Blueprint $blueprint) use ($columns) {
                $blueprint->id(array_shift($columns));
                foreach ($columns as $column) $blueprint->string($column)->nullable();
            });
        }
        Schema::create('bills', function (Blueprint $table) {
            $table->id('bill_id'); $table->string('bill_reference_no'); $table->integer('boat_id')->nullable(); $table->decimal('total_amount', 12, 2); $table->timestamps();
        });
        Schema::create('payments', function (Blueprint $table) {
            $table->id('payment_id'); $table->string('payment_reference_no'); $table->integer('bill_id'); $table->decimal('amount_paid', 12, 2);
            $table->string('status'); $table->string('official_receipt_no'); $table->string('payment_method'); $table->date('payment_date');
            $table->text('remarks')->nullable(); $table->integer('received_by')->nullable(); $table->timestamps();
        });
        ob_start();
        require base_path('scripts/add_payment_receipt_image_columns.php');
        ob_end_clean();
        DB::table('bills')->insert(['bill_id' => 1, 'bill_reference_no' => 'B00001', 'total_amount' => 100]);
        DB::table('payments')->insert([
            'payment_id' => 1, 'payment_reference_no' => '000001', 'bill_id' => 1, 'amount_paid' => 25,
            'status' => 'partial', 'official_receipt_no' => '0012345', 'payment_method' => 'cash', 'payment_date' => '2026-11-09',
            'official_receipt_image_url' => 'https://res.cloudinary.com/test/image/upload/old.png', 'official_receipt_image_public_id' => 'old-receipt',
        ]);
        $activity = Mockery::mock(ActivityLogService::class)->makePartial();
        $activity->shouldReceive('log')->andReturn(new ActivityLog());
        $this->app->instance(ActivityLogService::class, $activity);
    }

    protected function tearDown(): void
    {
        DB::purge('receipt_testing');
        parent::tearDown();
    }

    private function request(?UploadedFile $image = null, array $values = []): Request
    {
        return Request::create('/api/payments/1', 'POST', array_merge([
            'official_receipt_no' => '0012345', 'remarks' => 'Updated', 'minimal' => 1,
        ], $values), [], $image ? ['official_receipt_image' => $image] : []);
    }

    private function image(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('receipt.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='));
    }

    public function test_edit_without_image_retains_saved_receipt_and_payment_totals(): void
    {
        $storage = Mockery::mock(PaymentReceiptStorage::class);
        $storage->shouldNotReceive('upload'); $storage->shouldNotReceive('deleteIfUnused');
        $this->app->instance(PaymentReceiptStorage::class, $storage);
        $response = (new PaymentController())->update($this->request(), 1)->getData(true);
        $this->assertStringEndsWith('/old.png', $response['official_receipt_image_url']);
        $this->assertSame('25.00', Payment::find(1)->amount_paid);
        $this->assertSame('old-receipt', Payment::find(1)->official_receipt_image_public_id);
    }

    public function test_image_only_edit_saves_new_cloudinary_url_and_cleans_up_old_image(): void
    {
        $storage = Mockery::mock(PaymentReceiptStorage::class);
        $storage->shouldReceive('upload')->once()->andReturn([
            'official_receipt_image_url' => 'https://res.cloudinary.com/test/image/upload/new.png',
            'official_receipt_image_public_id' => 'new-receipt',
        ]);
        $storage->shouldReceive('deleteIfUnused')->once()->with('old-receipt');
        $this->app->instance(PaymentReceiptStorage::class, $storage);
        $response = (new PaymentController())->update($this->request($this->image(), ['remarks' => '']), 1)->getData(true);
        $this->assertStringEndsWith('/new.png', $response['official_receipt_image_url']);
        $this->assertSame('new-receipt', Payment::find(1)->official_receipt_image_public_id);
        $this->assertSame('25.00', Payment::find(1)->amount_paid);
    }

    public function test_upload_failure_keeps_original_payment_and_image(): void
    {
        $storage = Mockery::mock(PaymentReceiptStorage::class);
        $storage->shouldReceive('upload')->once()->andThrow(ValidationException::withMessages(['official_receipt_image' => 'Upload failed']));
        $storage->shouldNotReceive('deleteIfUnused');
        $this->app->instance(PaymentReceiptStorage::class, $storage);
        try {
            (new PaymentController())->update($this->request($this->image()), 1);
            $this->fail('The upload should fail.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('official_receipt_image', $exception->errors());
        }
        $this->assertSame('old-receipt', Payment::find(1)->official_receipt_image_public_id);
        $this->assertNull(Payment::find(1)->remarks);
    }

    public function test_non_image_and_oversized_uploads_are_rejected_before_upload(): void
    {
        $storage = Mockery::mock(PaymentReceiptStorage::class);
        $storage->shouldNotReceive('upload');
        $this->app->instance(PaymentReceiptStorage::class, $storage);
        foreach ([UploadedFile::fake()->create('receipt.pdf', 5, 'application/pdf'), UploadedFile::fake()->create('receipt.png', 10241, 'image/png')] as $file) {
            try {
                (new PaymentController())->update($this->request($file), 1);
                $this->fail('Invalid image must be rejected.');
            } catch (ValidationException $exception) {
                $this->assertArrayHasKey('official_receipt_image', $exception->errors());
            }
        }
    }

    public function test_failed_creation_discards_unreferenced_upload_without_creating_a_payment(): void
    {
        $storage = Mockery::mock(PaymentReceiptStorage::class);
        $storage->shouldReceive('upload')->once()->andReturn(['official_receipt_image_url' => 'https://example.test/new.png', 'official_receipt_image_public_id' => 'unreferenced']);
        $storage->shouldReceive('deleteIfUnused')->once()->with('unreferenced');
        $this->app->instance(PaymentReceiptStorage::class, $storage);
        try {
            (new PaymentController())->store($this->request($this->image(), ['official_receipt_no' => '0012346', 'amount_paid' => 10, 'payment_date' => '2026-11-09']));
            $this->fail('Missing bill must be rejected.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('bill_id', $exception->errors());
        }
        $this->assertSame(1, Payment::count());
    }

    public function test_storage_uploads_to_cloudinary_and_retains_shared_receipt_assets(): void
    {
        $api = Mockery::mock(UploadApi::class);
        $api->shouldReceive('upload')->once()->with(Mockery::type('string'), [
            'folder' => 'Opol Fish Port/OR Image', 'resource_type' => 'image',
        ])->andReturn(new ApiResponse(['secure_url' => 'https://res.cloudinary.com/test/image/upload/new.png', 'public_id' => 'new-receipt'], []));
        $api->shouldReceive('destroy')->once()->with('unreferenced', ['resource_type' => 'image', 'invalidate' => true])->andReturn(new ApiResponse(['result' => 'ok'], []));
        $cloud = Mockery::mock(Cloudinary::class);
        $cloud->shouldReceive('uploadApi')->twice()->andReturn($api);
        $storage = Mockery::mock(PaymentReceiptStorage::class)->makePartial()->shouldAllowMockingProtectedMethods();
        $storage->shouldReceive('client')->twice()->andReturn($cloud);
        $uploaded = $storage->upload($this->image());
        $this->assertSame('new-receipt', $uploaded['official_receipt_image_public_id']);
        $storage->deleteIfUnused('old-receipt'); // Still referenced: no Cloudinary call.
        $storage->deleteIfUnused('unreferenced');
    }

    public function test_a_database_save_failure_rolls_back_the_edit_and_discards_the_new_image(): void
    {
        $storage = Mockery::mock(PaymentReceiptStorage::class);
        $storage->shouldReceive('upload')->once()->andReturn(['official_receipt_image_url' => 'https://example.test/new.png', 'official_receipt_image_public_id' => 'new-receipt']);
        $storage->shouldReceive('deleteIfUnused')->once()->with('new-receipt');
        $this->app->instance(PaymentReceiptStorage::class, $storage);
        Payment::updating(fn () => throw new \RuntimeException('Simulated save failure'));
        try {
            (new PaymentController())->update($this->request($this->image()), 1);
            $this->fail('The save should fail.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Simulated save failure', $exception->getMessage());
        } finally {
            Payment::flushEventListeners();
            Payment::clearBootedModels();
        }
        $this->assertSame('old-receipt', Payment::find(1)->official_receipt_image_public_id);
        $this->assertNull(Payment::find(1)->remarks);
    }
}
