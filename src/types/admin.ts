// Reutilizamos los tipos base de la app de usuarios
export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  created_at: string
  user_type: string
  subscription_status: string
  specialty: string | null
  country: string | null
  birth_date: string | null
  subscription_expires_at: string | null
  auto_renewal_enabled: boolean
}

export interface Post {
  id: string
  title: string
  content: string
  author_id: string
  created_at: string
  views_count: number
  likes_count: number
  comments_count: number
  category: string | null
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  parent_id: string | null
  is_deleted: boolean
  deleted_at: string | null
}

// Tipos para sistema de notificaciones admin
export interface BroadcastNotificationRequest {
  type: 'email' | 'in_app' | 'both'
  category: 'critical' | 'important' | 'normal' | 'promotional'
  title: string
  message: string
  cta_text?: string
  cta_url?: string
  audience: 'all' | 'active' | 'inactive' | 'by_country' | 'by_specialty'
  audience_filter?: string
  template_id?: string
  scheduled_at?: string
}

export interface EmailTemplateRequest {
  template_key: string
  subject: string
  html_content: string
  is_active?: boolean
}

export interface NewsletterSendRequest {
  post_ids: string[]
  subject?: string
}

export interface NotificationStats {
  total_sent_today: number
  total_sent_week: number
  total_sent_month: number
  active_notifications: number
  failed_emails: number
  newsletter_subscribers: number
}

// Tipos específicos del admin
export interface AdminStats {
  totalUsers: number
  totalPosts: number
  totalComments: number
  activeSubscriptions: number
  // Nuevas estadísticas de notificaciones
  emailsSentToday: number
  activeNotifications: number
  newsletterSubscribers: number
}