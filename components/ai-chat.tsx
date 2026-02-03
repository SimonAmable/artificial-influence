"use client"

import * as React from "react"
import { Chat, useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { motion, AnimatePresence } from "framer-motion"
import { X, ArrowUp, Plus, NotePencil, UploadSimple } from "@phosphor-icons/react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MemoizedMarkdown } from "@/components/memoized-markdown"

// Create shared chat instance
const chat = new Chat({
  transport: new DefaultChatTransport({
    api: "/api/chat",
  }),
})

interface AIChatProps {
  className?: string
}

export function AIChat({ className }: AIChatProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isDraggingOver, setIsDraggingOver] = React.useState(false)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const chatContainerRef = React.useRef<HTMLDivElement>(null)

  const { messages } = useChat({ chat, experimental_throttle: 50 })

  const clearMessages = () => {
    chat.messages = []
  }

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Listen for chat-open event
  React.useEffect(() => {
    const handleOpenChat = () => {
      setIsOpen(true)
    }

    window.addEventListener('chat-open' as any, handleOpenChat)
    return () => {
      window.removeEventListener('chat-open' as any, handleOpenChat)
    }
  }, [])

  // Handle drag and drop for files and canvas nodes
  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(true)
  }, [])

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set to false if leaving the chat container entirely
    if (chatContainerRef.current && !chatContainerRef.current.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false)
    }
  }, [])

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    
    // Extract node data if dragging from canvas
    const nodeDataStr = e.dataTransfer.getData('application/reactflow-node')
    
    if (nodeDataStr) {
      try {
        const nodeData = JSON.parse(nodeDataStr)
        
        // Extract asset URL based on node type
        let assetUrl: string | null = null
        let assetType: 'image' | 'video' | 'audio' | null = null

        if (nodeData.type === 'upload' && nodeData.data?.fileUrl) {
          assetUrl = nodeData.data.fileUrl
          assetType = nodeData.data.fileType || 'image'
        } else if (nodeData.type === 'image-gen' && nodeData.data?.generatedImageUrl) {
          assetUrl = nodeData.data.generatedImageUrl
          assetType = 'image'
        } else if (nodeData.type === 'video-gen' && nodeData.data?.generatedVideoUrl) {
          assetUrl = nodeData.data.generatedVideoUrl
          assetType = 'video'
        } else if (nodeData.type === 'audio' && nodeData.data?.generatedAudioUrl) {
          assetUrl = nodeData.data.generatedAudioUrl
          assetType = 'audio'
        }

        if (assetUrl && assetType) {
          // Dispatch custom event to add asset to message input
          const event = new CustomEvent('chat-add-asset', {
            detail: { url: assetUrl, type: assetType }
          })
          window.dispatchEvent(event)
        }
      } catch (error) {
        console.error('Failed to parse node data:', error)
      }
    }

    // Handle regular file drops
    const files = e.dataTransfer.files
    
    if (files && files.length > 0) {
      // Dispatch custom event to add files to message input
      const event = new CustomEvent('chat-add-files', {
        detail: { files }
      })
      window.dispatchEvent(event)
    }
  }, [])

  return (
    <>
      {/* Floating Trigger Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className={cn(
              "fixed bottom-6 right-6 z-40",
              "w-14 h-14 rounded-full",
              "bg-foreground",
              "shadow-lg",
              "flex items-center justify-center",
              "transition-shadow hover:shadow-xl",
              className
            )}
          >
            <Image src="/logo.svg" alt="AI" width={24} height={24} className="invert dark:invert-0" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
            />

            {/* Chat Container */}
            <motion.div
              ref={chatContainerRef}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "fixed right-0 top-0 bottom-0 z-50",
                "bg-background border-l border-border",
                "flex flex-col",
                // Mobile: fullscreen
                "w-full md:w-[480px]",
                "shadow-2xl"
              )}
            >
              {/* Drop Overlay */}
              <AnimatePresence>
                {isDraggingOver && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 pointer-events-none"
                  >
                    <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                      <UploadSimple className="w-12 h-12 text-primary" weight="bold" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-foreground">Drop to add attachment</p>
                      <p className="text-sm text-muted-foreground mt-1">Images, videos, or canvas nodes</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center">
                    <Image src="/logo.svg" alt="AI" width={16} height={16} className="invert dark:invert-0" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">AI Chat</h2>
                    <p className="text-xs text-muted-foreground">Powered by Gemini 2.5</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => clearMessages()}
                    className="h-8 w-8"
                    title="Clear chat"
                  >
                    <NotePencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-3 text-muted-foreground">
                    <Image src="/logo.svg" alt="AI" width={64} height={64} />
                    <div>
                      <p className="font-medium text-foreground">Start a conversation</p>
                      <p className="text-sm">Ask me anything</p>
                    </div>
                  </div>
                )}


                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-2",
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {/* AI Avatar */}
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 mt-1">
                        <Image src="/logo.svg" alt="AI" width={16} height={16} />
                      </div>
                    )}
                    
                    <div
                      className={cn(
                        "max-w-[80%] px-4 py-2",
                        message.role === 'user'
                          ? 'rounded-2xl bg-foreground text-background'
                          : 'text-foreground'
                      )}
                    >
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {message.parts.map((part, i) => {
                          if (part.type === 'text') {
                            return (
                              <MemoizedMarkdown
                                key={`${message.id}-${i}`}
                                id={message.id}
                                content={part.text}
                              />
                            )
                          }
                          if (part.type === 'file') {
                            if (part.mediaType?.startsWith('image/')) {
                              return (
                                <Image
                                  key={`${message.id}-${i}`}
                                  src={part.url}
                                  alt={part.filename || 'attachment'}
                                  width={300}
                                  height={300}
                                  className="rounded-lg my-2"
                                />
                              )
                            }
                            if (part.mediaType?.startsWith('video/')) {
                              return (
                                <video
                                  key={`${message.id}-${i}`}
                                  src={part.url}
                                  controls
                                  className="rounded-lg my-2 max-w-full"
                                />
                              )
                            }
                          }
                          return null
                        })}
                      </div>
                    </div>
                  </div>
                ))}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Form */}
              <MessageInput />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

// Separate MessageInput component
const MessageInput = () => {
  const [input, setInput] = React.useState('')
  const [files, setFiles] = React.useState<FileList | undefined>(undefined)
  const [droppedAssets, setDroppedAssets] = React.useState<Array<{ url: string; type: string }>>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const { sendMessage } = useChat({ chat })

  // Listen for custom events from drag-and-drop
  React.useEffect(() => {
    const handleAddAsset = (e: CustomEvent<{ url: string; type: string }>) => {
      setDroppedAssets(prev => [...prev, e.detail])
    }

    const handleAddFiles = (e: CustomEvent<{ files: FileList }>) => {
      setFiles(e.detail.files)
    }

    const handleAddText = (e: CustomEvent<{ text: string }>) => {
      setInput(prev => prev ? `${prev}\n\n${e.detail.text}` : e.detail.text)
    }

    window.addEventListener('chat-add-asset' as any, handleAddAsset)
    window.addEventListener('chat-add-files' as any, handleAddFiles)
    window.addEventListener('chat-add-text' as any, handleAddText)

    return () => {
      window.removeEventListener('chat-add-asset' as any, handleAddAsset)
      window.removeEventListener('chat-add-files' as any, handleAddFiles)
      window.removeEventListener('chat-add-text' as any, handleAddText)
    }
  }, [])

  // Convert files to data URLs for sending
  const convertFilesToDataURLs = async (fileList: FileList) => {
    return Promise.all(
      Array.from(fileList).map(
        file =>
          new Promise<{
            type: 'file'
            mediaType: string
            url: string
          }>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              resolve({
                type: 'file',
                mediaType: file.type,
                url: reader.result as string,
              })
            }
            reader.onerror = reject
            reader.readAsDataURL(file)
          }),
      ),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && !files && droppedAssets.length === 0) return

    const fileParts = files && files.length > 0 ? await convertFilesToDataURLs(files) : []
    
    // Add dropped assets from canvas nodes
    const assetParts = droppedAssets.map(asset => ({
      type: 'file' as const,
      mediaType: asset.type.includes('image') ? 'image/png' : asset.type.includes('video') ? 'video/mp4' : 'audio/mp3',
      url: asset.url,
    }))

    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: input }, ...fileParts, ...assetParts],
    })

    setInput('')
    setFiles(undefined)
    setDroppedAssets([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="p-4 shadow-lg">
      {/* File Preview */}
      {((files && files.length > 0) || droppedAssets.length > 0) && (
        <div className="mb-2 flex gap-2 flex-wrap">
          {/* Dropped assets from canvas nodes */}
          {droppedAssets.map((asset, index) => (
            <div key={`asset-${index}`} className="relative">
              {asset.type.includes('image') ? (
                <img
                  src={asset.url}
                  alt={`Canvas asset ${index + 1}`}
                  className="h-16 w-16 rounded object-cover"
                />
              ) : asset.type.includes('video') ? (
                <video
                  src={asset.url}
                  className="h-16 w-16 rounded object-cover"
                />
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setDroppedAssets(prev => prev.filter((_, i) => i !== index))
                }}
                className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center text-xs"
              >
                ×
              </button>
            </div>
          ))}
          
          {/* Regular file uploads */}
          {files && Array.from(files).map((file, index) => (
            <div key={`file-${index}`} className="relative">
              {file.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-16 w-16 rounded object-cover"
                />
              ) : file.type.startsWith('video/') ? (
                <video
                  src={URL.createObjectURL(file)}
                  className="h-16 w-16 rounded object-cover"
                />
              ) : null}
              <button
                type="button"
                onClick={() => {
                  const dt = new DataTransfer()
                  Array.from(files)
                    .filter((_, i) => i !== index)
                    .forEach(f => dt.items.add(f))
                  setFiles(dt.files.length > 0 ? dt.files : undefined)
                  if (fileInputRef.current) {
                    fileInputRef.current.files = dt.files
                  }
                }}
                className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files) {
              setFiles(e.target.files)
            }
          }}
          accept="image/*,video/*"
          multiple
          className="hidden"
        />
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 h-10 w-10 opacity-50 hover:opacity-100"
          >
            <Plus className="h-5 w-5" />
          </Button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder="Say something..."
            rows={3}
            className="flex-1 px-0 py-2 bg-transparent resize-none text-base focus:outline-none"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() && !files && droppedAssets.length === 0}
            className="shrink-0 h-10 w-10 bg-foreground hover:bg-foreground/90 text-background"
          >
            <ArrowUp className="h-5 w-5 text-background" weight="bold" />
          </Button>
        </div>
      </form>
    </div>
  )
}
