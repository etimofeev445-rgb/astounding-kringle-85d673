import { createFileRoute } from '@tanstack/react-router'
import { adPhoto } from '../../../../server/adPhotos'

// Serves an ad's photo from Netlify Blobs. URLs carry ?v=<updatedAt>, so they can be cached hard.
export const Route = createFileRoute('/api/ads/photo/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const photo = await adPhoto(params.id)
        if (!photo) return new Response('Not found', { status: 404 })
        return new Response(photo, {
          headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' },
        })
      },
    },
  },
})
