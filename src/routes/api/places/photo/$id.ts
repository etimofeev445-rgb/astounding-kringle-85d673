import { createFileRoute } from '@tanstack/react-router'
import { placePhoto } from '../../../../server/placePhotos'

// Serves a place's photo (or ?slot=cover) from Netlify Blobs. URLs carry ?v=<updatedAt>, so they can be cached hard.
export const Route = createFileRoute('/api/places/photo/$id')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const slot = new URL(request.url).searchParams.get('slot') === 'cover' ? 'cover' : 'photo'
        const photo = await placePhoto(params.id, slot)
        if (!photo) return new Response('Not found', { status: 404 })
        return new Response(photo, {
          headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' },
        })
      },
    },
  },
})
