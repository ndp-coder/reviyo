export type UserRole = 'user' | 'admin';

export type SubscriptionPlan = '1_month' | '6_months' | '12_months';
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';

export type PrivateFeedbackStatus = 'new' | 'seen' | 'resolved';

export type AnalyticsEventType =
  | 'qr_page_view'
  | 'review_started'
  | 'topics_selected'
  | 'review_generated'
  | 'review_regenerated'
  | 'review_copied'
  | 'google_review_opened'
  | 'private_feedback_submitted';

export type AIReviewStyle = 'standard' | 'shorter' | 'detailed';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  category: string;
  logo_url: string | null;
  google_review_url: string | null;
  welcome_message: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReviewTopic {
  id: string;
  business_id: string;
  label: string;
  display_order: number;
  active: boolean;
  created_at: string;
}

export interface PrivateFeedback {
  id: string;
  business_id: string;
  review_session_id: string | null;
  rating: number | null;
  message: string;
  status: PrivateFeedbackStatus;
  created_at: string;
}

export interface AnalyticsEvent {
  id: string;
  business_id: string;
  review_session_id: string | null;
  event_type: AnalyticsEventType;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Subscription {
  id: string;
  business_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  starts_at: string;
  expires_at: string | null;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
}

/** One row from create_review_session: the new visit plus the business's public details. */
export interface CreateSessionResult {
  session_id: string;
  session_token: string;
  business_id: string;
  business_name: string;
  business_slug: string;
  business_category: string;
  business_logo_url: string | null;
  business_welcome_message: string | null;
  business_google_review_url: string | null;
}

export interface AIReviewRequest {
  businessName: string;
  businessCategory: string;
  selectedTopics: string[];
  customerComment: string | null;
  requestedStyle: AIReviewStyle;
}

export interface AIReviewResponse {
  review: string;
  error?: string;
  /** HTTP status of a failed request; 429 means the drafting limit was reached. */
  status?: number;
}

export type PaymentOrderStatus = 'created' | 'attempted' | 'paid' | 'failed';

export interface PaymentOrder {
  id: string;
  business_id: string;
  user_id: string | null;
  order_id: string;
  payment_id: string | null;
  plan: SubscriptionPlan;
  amount: number;
  currency: string;
  status: PaymentOrderStatus;
  receipt: string | null;
  /** 'autopay' for charges made by AutoPay, 'one_time' for checkout purchases. */
  kind?: 'one_time' | 'autopay';
  charge_after?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RazorpayOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  plan: SubscriptionPlan;
  business_name?: string;
}

export interface RazorpayCheckoutSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}


export type AutopayMethod = 'upi' | 'card';

export type AutopayMandateStatus =
  | 'created'
  | 'authorized'
  | 'active'
  | 'paused'
  | 'rejected'
  | 'cancelled'
  | 'failed';

export interface AutopayMandate {
  id: string;
  business_id: string;
  plan: SubscriptionPlan;
  amount: number;
  method: AutopayMethod;
  status: AutopayMandateStatus;
  failed_attempts: number;
  auth_refund_id: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutopaySetupOrder {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  customer_id: string;
  method: AutopayMethod;
  plan: SubscriptionPlan;
  plan_amount: number;
  business_name?: string;
}
