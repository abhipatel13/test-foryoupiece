'use client'

import React, { useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GripVertical, Play, ImageIcon } from 'lucide-react'

type MediaItem = { kind: 'image' | 'video'; url: string; id?: string }

interface ProductMediaOrderProps {
  images: string[]
  videos: string[]
  order?: string[]
  onChange: (order: string[]) => void
}

// Utility: extract YouTube ID (supports watch, youtu.be, embed, shorts, and iframe embeds)
const extractYouTubeId = (input: string): string | null => {
  try {
    if (!input) return null
    const raw = String(input).trim()

    // Handle iframe embed code by extracting src attribute
    if (/^<iframe[\s\S]*?>/i.test(raw) || raw.toLowerCase().includes('<iframe')) {
      const match = raw.match(/src=["']([^"']+)["']/i)
      if (match && match[1]) {
        return extractYouTubeId(match[1])
      }
    }

    const maybeUrl = raw.startsWith('//') ? `https:${raw}` : raw
    const u = new URL(maybeUrl)
    const host = u.hostname

    if (host.includes('youtu.be')) {
      const id = u.pathname.replace(/^\//, '').split('/')[0]
      return id || null
    }

    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/')[2] || u.pathname.replace('/shorts/', '')
        return (id || '').split('?')[0] || null
      }
    }

    return null
  } catch {
    return null
  }
}

export function ProductMediaOrder({ images, videos, order, onChange }: ProductMediaOrderProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragIndexRef = useRef<number | null>(null)

  // Build mixed list honoring persisted order first; append missing (videos first, then images) for backward compatibility
  const mediaItems: MediaItem[] = useMemo(() => {
    const items: MediaItem[] = []
    const vSet = new Set(videos)
    const iSet = new Set(images)
    const seen = new Set<string>()

    if (order && order.length > 0) {
      for (const url of order) {
        if (vSet.has(url)) {
          items.push({ kind: 'video', url, id: extractYouTubeId(url) || undefined })
          seen.add(url)
        } else if (iSet.has(url)) {
          items.push({ kind: 'image', url })
          seen.add(url)
        }
      }
    }

    for (const url of videos) if (!seen.has(url)) items.push({ kind: 'video', url, id: extractYouTubeId(url) || undefined })
    for (const url of images) if (!seen.has(url)) items.push({ kind: 'image', url })

    return items
  }, [images, videos, order])

  const handleDragStart = (index: number, e: React.DragEvent) => {
    dragIndexRef.current = index
    e.dataTransfer.setData('text/plain', String(index))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (toIndex: number, e: React.DragEvent) => {
    e.preventDefault()
    const fromString = e.dataTransfer.getData('text/plain')
    const fromIndex = fromString ? parseInt(fromString, 10) : dragIndexRef.current
    setDragOverIndex(null)
    dragIndexRef.current = null
    if (fromIndex === null || isNaN(fromIndex)) return
    if (fromIndex === toIndex) return

    const next = [...mediaItems]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    onChange(next.map(i => i.url))
  }

  const handleDragEnd = () => {
    setDragOverIndex(null)
    dragIndexRef.current = null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Media Order (Images & Videos)</CardTitle>
        <CardDescription>
          Drag to reorder. The first item will be the primary media on the product page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mediaItems.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-gray-500">
            No media yet. Add images or YouTube videos above.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {mediaItems.map((item, index) => (
              <div
                key={`${item.kind}:${item.url}`}
                className={`relative rounded-lg border overflow-hidden bg-white select-none ${
                  dragOverIndex === index ? 'ring-2 ring-blue-500' : ''
                }`}
                draggable
                onDragStart={(e) => handleDragStart(index, e)}
                onDragOver={(e) => handleDragOver(index, e)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(index, e)}
                onDragEnd={handleDragEnd}
              >
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-1.5 py-1 rounded bg-white/90 text-xs text-gray-700">
                  <GripVertical className="w-3.5 h-3.5" />
                  Drag
                </div>
                <div className="relative aspect-square w-full overflow-hidden bg-gray-50">
                  {item.kind === 'image' ? (
                    <Image
                      src={item.url}
                      alt={`Image ${index + 1}`}
                      fill
                      className="object-contain p-2"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  ) : (
                    <>
                      {item.id ? (
                        <img
                          src={`https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`}
                          alt={`Video ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/60 rounded-full p-2">
                          <Play className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <Badge variant={index === 0 ? 'default' : 'secondary'} className="absolute bottom-2 left-2">
                  {index === 0 ? 'Primary' : `#${index + 1}`}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

