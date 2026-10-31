import { createFileRoute } from '@tanstack/react-router'
import { readAsset } from '../../../server/admin/content'

// Serves images uploaded in the admin panel (logo, banners). Keys are random and never reused.
export const Route = createFileRoute('/api/assets/$key')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const asset = await readAsset(params.key)
        if (!asset) return new Response('Not found', { status: 404 })
        return new Response(asset.bytes, {
          headers: { 'content-type': asset.type, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' },
        })
      },
    },
  },
})
