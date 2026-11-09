<?php

namespace App\Services;

use App\Models\Payment;
use Cloudinary\Cloudinary;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class PaymentReceiptStorage
{
    protected function client(): Cloudinary
    {
        $url = config('services.cloudinary.url');
        if (!$url) {
            $cloud = config('services.cloudinary.cloud_name');
            $key = config('services.cloudinary.api_key');
            $secret = config('services.cloudinary.api_secret');
            if (!$cloud || !$key || !$secret) {
                throw new RuntimeException('Cloudinary is not configured.');
            }
            $url = sprintf('cloudinary://%s:%s@%s', $key, $secret, $cloud);
        }

        return new Cloudinary($url);
    }

    public function upload(UploadedFile $image): array
    {
        try {
            $upload = $this->client()->uploadApi()->upload($image->getRealPath(), [
                'folder' => 'Opol Fish Port/OR Image',
                'resource_type' => 'image',
            ]);
            $url = $upload['secure_url'] ?? null;
            $publicId = $upload['public_id'] ?? null;
            if (!$url || !$publicId) {
                if ($publicId) $this->deleteIfUnused($publicId);
                throw new RuntimeException('Cloudinary returned incomplete receipt image details.');
            }

            return ['official_receipt_image_url' => $url, 'official_receipt_image_public_id' => $publicId];
        } catch (Throwable $exception) {
            report($exception);
            throw ValidationException::withMessages([
                'official_receipt_image' => 'Unable to upload the OR image. Please try again.',
            ]);
        }
    }

    // One receipt may cover several bills. Retain the asset while any payment
    // still references it, including when only one allocation is edited.
    public function deleteIfUnused(?string $publicId): void
    {
        if (!$publicId) return;
        try {
            if (Payment::where('official_receipt_image_public_id', $publicId)->exists()) return;
            $this->client()->uploadApi()->destroy($publicId, ['resource_type' => 'image', 'invalidate' => true]);
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
