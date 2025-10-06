'use client'

interface ImageLightboxProps {
  images: string[]
  currentIndex: number
  onClose: () => void
  onNext: () => void
  onPrev: () => void
}

export default function ImageLightbox({
  images,
  currentIndex,
  onClose,
  onNext,
  onPrev
}: ImageLightboxProps) {
  if (images.length === 0) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[60] bg-black bg-opacity-95 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Botón cerrar */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 z-10"
      >
        ×
      </button>

      {/* Contador */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white text-lg">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Botón anterior */}
      {images.length > 1 && currentIndex > 0 && (
        <button
          onClick={onPrev}
          className="absolute left-4 text-white text-6xl hover:text-gray-300 z-10"
        >
          ‹
        </button>
      )}

      {/* Imagen */}
      <div className="max-w-7xl max-h-[90vh] p-4">
        <img
          src={images[currentIndex]}
          alt={`Imagen ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* Botón siguiente */}
      {images.length > 1 && currentIndex < images.length - 1 && (
        <button
          onClick={onNext}
          className="absolute right-4 text-white text-6xl hover:text-gray-300 z-10"
        >
          ›
        </button>
      )}

      {/* Miniaturas */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 max-w-full overflow-x-auto px-4">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => {
                const diff = idx - currentIndex
                if (diff > 0) {
                  for (let i = 0; i < diff; i++) onNext()
                } else if (diff < 0) {
                  for (let i = 0; i < Math.abs(diff); i++) onPrev()
                }
              }}
              className={`w-16 h-16 flex-shrink-0 border-2 ${
                idx === currentIndex ? 'border-white' : 'border-transparent opacity-50'
              }`}
            >
              <img
                src={img}
                alt={`Miniatura ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}