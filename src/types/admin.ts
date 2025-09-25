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
  audience: BroadcastAudience
  template_id?: string
  scheduled_at?: string
  expires_at?: string
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

// Tipos para broadcast masivo
export interface BroadcastAudience {
  type: 'all' | 'active' | 'inactive' | 'by_country' | 'by_specialty'
  filter?: string
  count?: number
}

export interface BroadcastJob {
  id: string
  type: 'email' | 'in_app' | 'both'
  category: 'critical' | 'important' | 'normal' | 'promotional'
  title: string
  message: string
  audience: BroadcastAudience
  total_recipients: number
  sent_count: number
  failed_count: number
  status: 'pending' | 'sending' | 'completed' | 'failed'
  created_at: string
  started_at?: string
  completed_at?: string
}

export interface BroadcastResponse {
  job_id: string
  total_recipients: number
  estimated_time: string
  status: 'queued' | 'started' | 'completed' | 'failed'
}

export interface NotificationStats {
  total_sent_today: number
  total_sent_week: number
  total_sent_month: number
  active_notifications: number
  failed_emails: number
  newsletter_subscribers: number
}

// Tipos para sistema de logs
export interface EmailLog {
  id: string
  user_id: string
  template_key: string
  email: string
  status: 'sent' | 'failed' | 'delivered'
  resend_id: string | null
  error_message: string | null
  sent_at: string
  // Datos relacionados del usuario
  user?: {
    full_name: string | null
    subscription_status: string
  }
}

export interface Notification {
  id: string
  user_id: string
  type: 'email' | 'in_app'
  category: 'critical' | 'important' | 'normal' | 'promotional'
  title: string
  message: string
  cta_text: string | null
  cta_url: string | null
  is_read: boolean
  expires_at: string | null
  created_at: string
  created_by_admin_id: string | null
  // Datos relacionados del usuario
  user?: {
    full_name: string | null
    email: string
  }
}

export interface LogsFilters {
  type?: 'email' | 'notification' | 'all'
  status?: 'sent' | 'failed' | 'delivered'
  user_email?: string
  template_key?: string
  date_from?: string
  date_to?: string
  page?: number
  limit?: number
}

export interface LogsResponse {
  email_logs: EmailLog[]
  notifications: Notification[]
  pagination: {
    total_records: number
    total_pages: number
    current_page: number
    has_next: boolean
    has_prev: boolean
  }
  summary: {
    total_emails: number
    successful_emails: number
    failed_emails: number
    total_notifications: number
  }
}

export interface DetailedStats {
  emails: {
    sent_today: number
    sent_this_week: number
    sent_this_month: number
    failed_today: number
    success_rate: number
  }
  notifications: {
    active_count: number
    read_count: number
    unread_count: number
    critical_count: number
  }
  templates: {
    most_used: string[]
    total_templates: number
  }
  users: {
    newsletter_subscribers: number
    promotional_subscribers: number
    total_users: number
  }
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