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
  template_key?: string | null 
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
  email_count: number
  notification_count: number
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

// Tipos para sistema de gestión de imágenes
export interface ImageSettings {
  max_images_per_post: number
  max_image_size_mb: number
  allowed_formats: string[]
  compression_quality: number
  max_width: number
  max_height: number
}

export interface StorageStats {
  total_images: number
  storage_used_mb: number
  storage_used_gb: number
  images_this_month: number
  images_this_week: number
  average_images_per_post: number
  top_uploaders: Array<{
    user_id: string
    user_name: string
    image_count: number
  }>
  monthly_trend: Array<{
    month: string
    count: number
  }>
}

// Tipos para sistema de moderación y baneo
export interface BanUserRequest {
  reason: string
  admin_id: string
}

export interface BanUserResponse {
  success: boolean
  user_id: string
  paypal_cancelled: boolean
  error?: string
}

export interface UnbanUserRequest {
  admin_id: string
  reason?: string
}

export interface ModerationLog {
  id: string
  admin_id: string
  action_type: 'ban_user' | 'unban_user' | 'delete_post' | 'delete_comment' | 'approve_post'
  target_type: 'user' | 'post' | 'comment'
  target_id: string
  reason: string | null
  metadata: any
  created_at: string
}

export interface PostWithAuthor extends Post {
  author: {
    id: string
    full_name: string | null
    email: string
    country: string | null
    specialty: string | null
    user_type: string
    subscription_status: string
    is_banned: boolean
    created_at: string
  }
  images: string[]
  is_reviewed: boolean
  reviewed_at: string | null
  reviewed_by: string | null
  is_deleted: boolean
  deleted_at: string | null
}

export interface CommentWithUser extends Comment {
  user: {
    id: string
    full_name: string | null
    email: string
    is_banned: boolean
  }
  reviewed_at: string | null
  reviewed_by: string | null
}

export interface UserStats {
  total_posts: number
  total_comments: number
  deleted_posts: number
  deleted_comments: number
  ban_history: Array<{
    banned_at: string
    banned_reason: string
    unbanned_at: string | null
  }>
}

export interface ProfileWithStats extends Profile {
  is_banned: boolean
  banned_at: string | null
  banned_reason: string | null
  banned_by: string | null
  paypal_subscription_id: string | null
  stats?: UserStats
}

export interface ModerationStats {
  posts: {
    total: number
    today: number
    this_week: number
    this_month: number
    deleted_today: number
    deleted_week: number
    deleted_month: number
    pending_review: number
  }
  comments: {
    total: number
    today: number
    this_week: number
    this_month: number
    deleted_today: number
    deleted_week: number
    deleted_month: number
  }
  users: {
    total_active: number
    total_banned: number
    banned_today: number
    banned_week: number
    banned_month: number
  }
}

export interface UserHistoryPagination {
  posts: {
    current_page: number
    total_pages: number
    total_items: number
    items_per_page: number
    has_next: boolean
    has_prev: boolean
  }
  comments: {
    current_page: number
    total_pages: number
    total_items: number
    items_per_page: number
    has_next: boolean
    has_prev: boolean
  }
}

export interface UserHistoryResponse {
  user: ProfileWithStats
  posts: PostWithAuthor[]
  comments: CommentWithUser[]
  moderation_history: ModerationLog[]
  stats: UserStats
  pagination: UserHistoryPagination
}

export interface ImageSettingsUpdateRequest {
  max_images_per_post?: number
  max_image_size_mb?: number
  allowed_formats?: string[]
  compression_quality?: number
  max_width?: number
  max_height?: number
}

export interface PostsFilters {
  category?: string
  authorEmail?: string
  authorName?: string
  dateFrom?: string
  dateTo?: string
  minComments?: string
  hasImages?: 'true' | 'false' | 'all'
  authorStatus?: 'active' | 'banned' | 'all'
  isReviewed?: 'true' | 'false' | 'all'
  showDeleted?: 'true' | 'false' | 'only'
}

export interface PostsSortOptions {
  sortBy: 'created_at' | 'views_count' | 'likes_count' | 'comments_count' | 'title'
  sortOrder: 'asc' | 'desc'
}

// Tipos para PostDetailModal
export interface PostDetailAuthor {
  id: string
  full_name: string | null
  email: string
  country: string | null
  specialty: string | null
  user_type: string
  subscription_status: string
  is_banned: boolean
  banned_at: string | null
  banned_reason: string | null
  created_at: string
  paypal_subscription_id: string | null
  stats: {
    total_posts: number
    total_comments: number
    deleted_comments: number
    ban_history: ModerationLog[]
  }
}

export interface PostDetailData {
  id: string
  title: string
  content: string
  author_id: string
  created_at: string
  views_count: number
  likes_count: number
  comments_count: number
  category: string | null
  images: string[]
  is_reviewed: boolean
  reviewed_at: string | null
  reviewed_by: string | null
  is_deleted: boolean
  deleted_at: string | null
}

export interface PostDetailResponse {
  success: boolean
  data: {
    post: PostDetailData
    author: PostDetailAuthor
    comments: CommentWithUser[]
  }
}

export interface PostsListResponse {
  success: boolean
  data: PostWithAuthor[]
  pagination: {
    current_page: number
    total_pages: number
    total_records: number
    limit: number
    has_next: boolean
    has_prev: boolean
  }
}