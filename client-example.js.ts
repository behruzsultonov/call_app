import axios, { type AxiosPromise } from 'axios';

// Lesson interface
export interface Lesson {
  id: string;
  section_id: string;
  title: string;
  description?: string;
  type: 'video' | 'text' | 'quiz' | 'practice';
  duration?: number;
  sort_order: number;
  is_active: boolean;
  video_url?: string;
  content?: string;
  created_at: string;
  updated_at: string;
  is_locked?: boolean;
  is_completed?: boolean;
  course_id?: string; // Added missing property
}

// Course section interface
export interface CourseSection {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  lessons_count: number;
  lessons?: Lesson[];
  progress_percentage?: number;
}

// Course related interfaces
export interface Course {
  id: string;
  title: string;
  description: string;
  instructor_name?: string;
  author_name?: string;
  category_name: string;
  level: string;
  duration: number;
  duration_hours?: number;
  price: number;
  rating: number | string;
  students_count: number;
  lessons_count: number;
  thumbnail_url?: string; // Changed from cover_image to match database field
  is_active: boolean;
  created_at: string;
  // Additional fields from backend
  sections?: CourseSection[];
  progress_percentage?: number;
  completed_lessons?: number;
  total_lessons?: number;
  total_duration?: number;
  prerequisites?: string[];
  learning_outcomes?: string[];
  tags?: string[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  sort_order: number;
  course_count: number;
  created_at: string;
}

// Review interfaces
export interface Review {
  id: string;
  user_id: string;
  course_id: string;
  rating: number;
  title: string;
  comment: string;
  is_approved: number;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_avatar?: string;
}

export interface CourseReviewsResponse {
  course: Course;
  reviews: Review[];
  statistics: {
    average_rating: string;
    total_reviews: string;
    five_star: string;
    four_star: string;
    three_star: string;
    two_star: string;
    one_star: string;
  };
  user_review: Review | null;
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface CoursesResponse {
  courses: Course[];
  pagination?: Pagination;
}

export interface CourseResponse {
  course: Course;
}

// Quiz interfaces
export interface Quiz {
  id: string;
  lesson_id: string;
  title: string;
  description: string;
  time_limit: number | null;
  passing_score: number;
  max_attempts: number;
  is_active: number; // Changed from boolean to number as per API response
  created_at: string;
  updated_at: string;
  lesson_title: string; // Added missing field
  questions: QuizQuestion[];
  explanation?: string; // Added missing field
}

export interface QuizQuestion {
  id: string;
  question_text: string;
  question_type: string; // Changed from 'single' | 'multiple' to string to match API
  options: string; // JSON string
  correct_answer: string; // Added missing field
  points: number;
  sort_order: number;
  explanation?: string; // Made optional
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  quiz_id: string;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  passed: number | null;
  time_taken: number | null;
  answers: string | null;
  // Additional fields from get_quiz_results
  quiz_title?: string;
  quiz_description?: string;
  passing_score?: number;
  lesson_title?: string;
  course_title?: string;
}

export interface QuizResult {
  attempt: QuizAttempt;
  total_points: number;
  earned_points: number;
}

export interface QuizHistory {
  history: QuizAttempt[];
  summary: any[];
}

// Use the full domain with port for local development
const PHP_API_URL = 'https://sadoapp.tj/edu-be/index.php';
// const PHP_API_URL = 'http://edu/index.php'; // Local development URL with proper domain

// Extract base URL from API URL for avatar construction
const getBaseUrl = (): string => {
  try {
    const url = new URL(PHP_API_URL);
    // Extract protocol, host, and pathname (without the filename)
    const basePath = url.pathname.substring(0, url.pathname.lastIndexOf('/'));
    return `${url.protocol}//${url.host}${basePath}`;
  } catch (e) {
    // Fallback to localhost for development
    return 'http://localhost:5173';
  }
};

interface UserResponse {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  onboardingCompleted?: boolean;
  onboardingGoal?: string;
  onboardingLevel?: string;
  onboardingDirection?: string;
  avatarUrl?: string;
  bio?: string;
  language?: string;
  timezone?: string;
  isActive?: boolean;
  phoneVerified?: boolean;
  authMethod?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface LoginResponse {
  user: UserResponse;
  token: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  user?: UserResponse;
  token?: string;
}

interface ProfileData {
  id: string;
  phone: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  avatarUrl?: string;
  bio?: string;
  language?: string;
  timezone?: string;
  isActive?: boolean;
  phoneVerified?: boolean;
  authMethod?: string;
  createdAt?: string;
  updatedAt?: string;
  onboarding?: {
    completed?: boolean;
    goal?: string;
    level?: string;
    direction?: string;
  };
  statistics?: {
    enrolledCourses?: number;
    completedLessons?: number;
    completedCourses?: number;
  };
}

interface SubscriptionData {
  has_subscription: boolean;
  is_active: boolean;
  status: 'active' | 'cancelled' | 'expired' | 'suspended' | 'none';
  subscription?: {
    id: string;
    user_id: string;
    subscription_id: string;
    plan_name: string;
    plan_description: string;
    billing_cycle: 'monthly' | 'yearly';
    status: 'active' | 'cancelled' | 'expired' | 'suspended';
    started_at: string;
    expires_at: string;
    is_expired: boolean;
    days_remaining: number;
    auto_renew: boolean;
    cancelled_at: string | null;
  };
  message?: string;
}

// Add a helper function to fix avatar URLs
const fixAvatarUrl = (avatarUrl?: string): string | undefined => {
  if (!avatarUrl) return undefined;
  
  // Get the base URL dynamically
  const baseUrl = getBaseUrl();
  
  // If it's already an absolute URL with the correct domain, use it as is
  if (avatarUrl.startsWith(baseUrl)) {
    return avatarUrl;
  } 
  // If it's an absolute URL with wrong domain, replace the domain
  else if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    // Replace the domain with the correct one
    try {
      const urlObj = new URL(avatarUrl);
      const path = urlObj.pathname + urlObj.search + urlObj.hash;
      return `${baseUrl}${path}`;
    } catch (e) {
      // If URL parsing fails, fallback to relative path handling
      if (avatarUrl.startsWith('/')) {
        return `${baseUrl}${avatarUrl}`;
      } else {
        return `${baseUrl}/${avatarUrl}`;
      }
    }
  }
  // If it's a relative URL starting with '/', construct the full URL with the correct base
  else if (avatarUrl.startsWith('/')) {
    // Use the correct base URL
    return `${baseUrl}${avatarUrl}`;
  } 
  // If it's a relative URL without '/', add the leading slash
  else {
    // Use the correct base URL
    return `${baseUrl}/${avatarUrl}`;
  }
};

interface CertificateDetails {
  id: string;
  courseId: string;
  courseName: string;
  userName: string;
  issueDate: string;
  certificateNumber: string;
  verificationCode: string;
  instructor: string;
  duration: string;
  level: string;
}

interface Api {
  getLesson(lessonId: string): AxiosPromise<ApiResponse<{ lesson: Lesson }>>;
  getLessonVideo(lessonId: string): AxiosPromise<ApiResponse<{ video_url: string; meta?: any }>>;
  getLessonAttachments(lessonId: string): AxiosPromise<ApiResponse<{ attachments: any[] }>>;
  markLessonComplete(lessonId: string): AxiosPromise<ApiResponse>;
  getCourseLessons(courseId: string): AxiosPromise<ApiResponse<{ lessons: Lesson[] }>>;
  getCourseSections(courseId: string): AxiosPromise<ApiResponse<{ sections: CourseSection[] }>>;
  // AUTHENTICATION ENDPOINTS
  sendSms(phone: string): AxiosPromise<ApiResponse>;
  verifyPhone(phone: string, code: string): AxiosPromise<ApiResponse<LoginResponse>>;
  logout(token: string): AxiosPromise<ApiResponse>;
  
  // PROFILE ENDPOINTS
  completeOnboarding(data: { goal: string; level: string; direction: string }): AxiosPromise<ApiResponse>;
  getUserProfile(): AxiosPromise<ApiResponse<ProfileData>>;
  updateUserProfile(data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    bio?: string;
    language?: string;
    timezone?: string;
  }): AxiosPromise<ApiResponse<ProfileData>>;
  uploadAvatar(file: File): AxiosPromise<ApiResponse<{ avatarUrl: string }>>;
  getUserSubscription(): AxiosPromise<ApiResponse<SubscriptionData>>;
  
  // COURSES ENDPOINTS
  getCourses(filters?: {
    level?: string;
    category_id?: string;
    featured?: boolean;
    status?: string;
    page?: number;
    limit?: number;
    duration?: string; // Add duration filter
  }): AxiosPromise<ApiResponse<CoursesResponse>>;
  getCourse(courseId: string): AxiosPromise<ApiResponse<CourseResponse>>;
  getFeaturedCourses(): AxiosPromise<ApiResponse<CoursesResponse>>;
  searchCourses(query: string, options?: {
    page?: number;
    limit?: number;
  }): AxiosPromise<ApiResponse<CoursesResponse>>;
  getPopularCourses(limit?: number): AxiosPromise<ApiResponse<CoursesResponse>>;
  getUserCertificates(): AxiosPromise<ApiResponse<{ certificates: any[] }>>;
  getCertificateDetails(certificateId: string): AxiosPromise<ApiResponse<CertificateDetails>>;
  getCertificatePdf(certificateId: string): AxiosPromise<ApiResponse>;
  requestCertificate(courseId: string): AxiosPromise<ApiResponse>;
  getCategories(): AxiosPromise<ApiResponse<{ categories: Category[] }>>;
  
  // COURSE ENROLLMENT ENDPOINTS
  enrollCourse(courseId: string): AxiosPromise<ApiResponse>;
  getEnrolledCourses(): AxiosPromise<ApiResponse<CoursesResponse>>;
  unenrollCourse(courseId: string): AxiosPromise<ApiResponse>;
  
  // PROGRESS ENDPOINTS
  getUserProgress(userId: string, courseId?: string | null): AxiosPromise<ApiResponse>;
  updateLessonProgress(userId: string, lessonId: string, progressData: any): AxiosPromise<ApiResponse>;
  getRecentActivity(): AxiosPromise<ApiResponse<any>>; // Add this line
  
  // REVIEW ENDPOINTS
  getCourseReviews(courseId: string, page?: number, limit?: number): AxiosPromise<ApiResponse<CourseReviewsResponse>>;
  createReview(data: { course_id: string; rating: number; title: string; comment: string }): AxiosPromise<ApiResponse<{ review: Review }>>;
  updateReview(reviewId: string, data: { rating?: number; title?: string; comment?: string }): AxiosPromise<ApiResponse<{ review: Review }>>;
  deleteReview(reviewId: string): AxiosPromise<ApiResponse>;
  
  // LESSON COMMENTS ENDPOINTS
  getLessonComments(lessonId: string): AxiosPromise<ApiResponse<{ comments: any[] }>>;
  createLessonComment(data: { lesson_id: string; comment: string; parent_id?: string }): AxiosPromise<ApiResponse<{ comment: any }>>;
  updateLessonComment(commentId: string, data: { comment: string }): AxiosPromise<ApiResponse<{ comment: any }>>;
  deleteLessonComment(commentId: string): AxiosPromise<ApiResponse>;
  likeLessonComment(commentId: string): AxiosPromise<ApiResponse<{ liked: boolean }>>;
  
  // HELPER FUNCTIONS
  setAuthToken(token: string | null): void;
  getAuthToken(): string | null;
  // Add put and delete methods
  put<T = any>(url: string, data?: any, config?: any): AxiosPromise<T>;
  delete<T = any>(url: string, config?: any): AxiosPromise<T>;
  
  // QUIZ ENDPOINTS
  getQuiz(lessonId: string): AxiosPromise<ApiResponse<{ quiz: Quiz }>>;
  startQuizAttempt(quizId: string): AxiosPromise<ApiResponse<{ attempt: QuizAttempt }>>;
  submitQuizAttempt(attemptId: string, answers: any): AxiosPromise<ApiResponse<QuizResult>>;
  getQuizResults(attemptId: string): AxiosPromise<ApiResponse<{ attempt: QuizAttempt & { questions: (QuizQuestion & { user_answer: any; is_correct: boolean })[] } }>>;
  getUserQuizHistory(): AxiosPromise<ApiResponse<QuizHistory>>;
}

// Create axios instance with timeout and better configuration
const axiosInstance = axios.create({
  timeout: 60000, // Increased timeout to 30 seconds
  headers: {
    'X-Requested-With': 'XMLHttpRequest'
  }
});

// Store the auth token
let authToken: string | null = null;

// Add request interceptor for logging only (no token handling)
axiosInstance.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for logging
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized errors by redirecting to login
    if (error.response && error.response.status === 401) {
      // Clear auth data from localStorage
      localStorage.removeItem('user');
      localStorage.removeItem('authToken');
      localStorage.removeItem('sessionStartTime');
      
      // Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/edu/login';
      }
    }
    return Promise.reject(error);
  }
);

const api: Api = {
  // Add put method
  put: (url, data, config) => {
    return axiosInstance.put(url, data, config);
  },
  
  // Add delete method
  delete: (url, config) => {
    return axiosInstance.delete(url, config);
  },
  
  getCourseLessons: (courseId) => {
    // Get token from stored value
    const token = authToken;
    
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=get_course_lessons&course_id=${encodeURIComponent(courseId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url).then(response => {
      return response;
    }).catch(error => {
      // Handle authentication errors
      if (error.response && error.response.status === 401) {
        // Let the AuthContext handle token clearing
      }
      throw error;
    });
  },

  getCourseSections: (courseId) => {
    // Get token from stored value
    const token = authToken;
    
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=get_course_sections&course_id=${encodeURIComponent(courseId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url).then(response => {
      return response;
    }).catch(error => {
      // Handle authentication errors
      if (error.response && error.response.status === 401) {
        // Let the AuthContext handle token clearing
      }
      throw error;
    });
  },

  // Get lesson content and details
  getLesson: (lessonId) => {
    // Get token from stored value
    const token = authToken;
    
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=get_lesson&id=${encodeURIComponent(lessonId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url).then(response => {
      return response;
    }).catch(error => {
      // Handle authentication errors
      if (error.response && error.response.status === 401) {
        // Let the AuthContext handle token clearing
      }
      throw error;
    });
  },

  // Get lesson video
  getLessonVideo: (lessonId) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=get_lesson_video&id=${encodeURIComponent(lessonId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url);
  },

  // Get lesson attachments
  getLessonAttachments: (lessonId) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=get_lesson_attachments&lesson_id=${encodeURIComponent(lessonId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url);
  },
  // ================================
  // AUTHENTICATION ENDPOINTS
  // ================================
  
  // Send SMS verification code
  sendSms: (phone) => {
    return axiosInstance.post(PHP_API_URL, {
      action: 'send_sms',
      phone: phone
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },

  // Verify phone with SMS code
  verifyPhone: (phone, code) => {
    return axiosInstance.post(PHP_API_URL, {
      action: 'verify_phone',
      phone: phone,
      code: code
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(response => {
      // Fix avatar URL if present in response
      if (response.data?.data?.user?.avatarUrl) {
        response.data.data.user.avatarUrl = fixAvatarUrl(response.data.data.user.avatarUrl);
      }
      if (response.data?.user?.avatarUrl) {
        response.data.user.avatarUrl = fixAvatarUrl(response.data.user.avatarUrl);
      }
      return response;
    });
  },

  // Logout user
  logout: (token) => {
    // Build URL with action and token as query parameters
    const url = `${PHP_API_URL}?action=logout&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.post(url, {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },

  // ================================
  // PROFILE ENDPOINTS
  // ================================
  
  // Complete onboarding
  completeOnboarding: (data) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters
    const url = `${PHP_API_URL}?action=complete_onboarding&token=${encodeURIComponent(token)}`;
    
    // Send exactly as Postman does - JSON in request body with both query param and header auth
    return axiosInstance.post(url, data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },

  // Get user profile
  getUserProfile: () => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters
    const url = `${PHP_API_URL}?action=get_user_profile&token=${encodeURIComponent(token)}`;
    
    // Send exactly as Postman does - query params with token
    return axiosInstance.get(url).then(response => {
      // Fix avatar URL if present in response
      if (response.data?.data?.avatarUrl) {
        response.data.data.avatarUrl = fixAvatarUrl(response.data.data.avatarUrl);
      }
      return response;
    });
  },

  // Update user profile
  updateUserProfile: (data) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters
    const url = `${PHP_API_URL}?action=update_user_profile&token=${encodeURIComponent(token)}`;
    
    // Send exactly as Postman does - JSON in request body with query param
    return axiosInstance.post(url, data, {
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(response => {
      // Fix avatar URL if present in response
      if (response.data?.data?.avatarUrl) {
        response.data.data.avatarUrl = fixAvatarUrl(response.data.data.avatarUrl);
      }
      return response;
    });
  },

  // Upload avatar
  uploadAvatar: (file) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=upload_avatar&token=${encodeURIComponent(token)}`;
    
    // Create FormData with only the file
    const formData = new FormData();
    formData.append('avatar', file);
    
    // Send as form data with token in query parameter (Postman format)
    return axiosInstance.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }).then(response => {
      // Fix avatar URL if present in response
      if (response.data?.data?.avatarUrl) {
        response.data.data.avatarUrl = fixAvatarUrl(response.data.data.avatarUrl);
      }
      return response;
    });
  },

  // ================================
  // COURSES ENDPOINTS
  // ================================

  // Get all courses
  getCourses: (filters) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    let url = `${PHP_API_URL}?action=get_courses&token=${encodeURIComponent(token)}`;
    
    // Add filters if provided
    if (filters) {
      if (filters.level) url += `&level=${encodeURIComponent(filters.level)}`;
      if (filters.category_id) url += `&category_id=${encodeURIComponent(filters.category_id)}`;
      if (filters.featured !== undefined) url += `&featured=${encodeURIComponent(filters.featured.toString())}`;
      if (filters.status) url += `&status=${encodeURIComponent(filters.status)}`;
      if (filters.page !== undefined) url += `&page=${encodeURIComponent(filters.page.toString())}`;
      if (filters.limit !== undefined) url += `&limit=${encodeURIComponent(filters.limit.toString())}`;
      if (filters.duration) url += `&duration=${encodeURIComponent(filters.duration)}`; // Add duration filter
    }
    
    return axiosInstance.get(url);
  },

  // Get single course with details
  getCourse: (courseId: string) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=get_course&id=${encodeURIComponent(courseId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url);
  },

  // Get featured courses for homepage
  getFeaturedCourses: () => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=get_featured_courses&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url);
  },

  // Search courses by title/description
  searchCourses: (query, options) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    let url = `${PHP_API_URL}?action=search_courses&query=${encodeURIComponent(query)}&token=${encodeURIComponent(token)}`;
    
    if (options) {
      if (options.page !== undefined) url += `&page=${encodeURIComponent(options.page.toString())}`;
      if (options.limit !== undefined) url += `&limit=${encodeURIComponent(options.limit.toString())}`;
    }
    
    return axiosInstance.get(url);
  },

  // Get most popular courses
  getPopularCourses: (limit) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    let url = `${PHP_API_URL}?action=get_popular_courses&token=${encodeURIComponent(token)}`;
    
    if (limit !== undefined) url += `&limit=${encodeURIComponent(limit.toString())}`;
    
    return axiosInstance.get(url);
  },

  // ================================
  // COURSE ENROLLMENT ENDPOINTS
  // ================================

  // Enroll in a course
  enrollCourse: (courseId: string) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=enroll_course&course_id=${encodeURIComponent(courseId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url).then(response => {
      return response;
    }).catch(error => {
      throw error;
    });
  },

  // Get user's enrolled courses
  getEnrolledCourses: () => {
    // Get token from stored value
    const token = authToken;
    
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=get_enrolled_courses&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url).then(response => {
      return response;
    }).catch(error => {
      // Handle authentication errors
      if (error.response && error.response.status === 401) {
        // Let the AuthContext handle token clearing
      }
      throw error;
    });
  },

  // Unenroll from a course
  unenrollCourse: (courseId: string) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=unenroll_course&course_id=${encodeURIComponent(courseId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url);
  },

  // ================================
  // PROGRESS ENDPOINTS
  // ================================

  // Get user learning progress
  getUserProgress: (userId: string, courseId: string | null = null) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    let url = `${PHP_API_URL}?action=get_user_progress&user_id=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
    
    if (courseId) {
      url += `&course_id=${encodeURIComponent(courseId)}`;
    }
    
    return axiosInstance.get(url);
  },

  // Update lesson progress
  updateLessonProgress: (userId: string, lessonId: string, progressData: any) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=update_lesson_progress&user_id=${encodeURIComponent(userId)}&lesson_id=${encodeURIComponent(lessonId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.post(url, progressData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },

  // Mark lesson as complete
  markLessonComplete: (lessonId: string) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=mark_lesson_complete&lesson_id=${encodeURIComponent(lessonId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.post(url, {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },

  // ================================
  // REVIEW ENDPOINTS
  // ================================
  
  // Get course reviews
  getCourseReviews: (courseId, page = 1, limit = 10) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=get_course_reviews&course_id=${encodeURIComponent(courseId)}&page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url);
  },
  
  // Create a new review
  createReview: (data) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters
    const url = `${PHP_API_URL}?action=create_review&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.post(url, data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },
  
  // Update an existing review
  updateReview: (reviewId, data) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters
    const url = `${PHP_API_URL}?action=update_review&id=${encodeURIComponent(reviewId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.post(url, data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },
  
  // Delete a review
  deleteReview: (reviewId) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters
    const url = `${PHP_API_URL}?action=delete_review&id=${encodeURIComponent(reviewId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.post(url, {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },
  
  // ================================
  // HELPER FUNCTIONS
  // ================================

  // Set authorization token for requests
  setAuthToken: (token: string | null) => {
    authToken = token;
    
    // We're passing the token in URL parameters, so we don't need to set the Authorization header
    // This avoids conflicts with our manual token handling
  },
  
  // Get current authorization token
  getAuthToken: () => {
    return authToken;
  },
  
  // ================================
  // LESSON COMMENTS ENDPOINTS
  // ================================
  
  // Get lesson comments
  getLessonComments: (lessonId) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=get_lesson_comments&lesson_id=${encodeURIComponent(lessonId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url);
  },
  
  // Create a new lesson comment
  createLessonComment: (data) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters
    const url = `${PHP_API_URL}?action=create_comment&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.post(url, data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },
  
  // Update an existing lesson comment
  updateLessonComment: (commentId, data) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters
    const url = `${PHP_API_URL}?action=update_comment&id=${encodeURIComponent(commentId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.post(url, data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },
  
  // Delete a lesson comment
  deleteLessonComment: (commentId) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters
    const url = `${PHP_API_URL}?action=delete_comment&id=${encodeURIComponent(commentId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.post(url, {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },
  
  // Like/unlike a lesson comment
  likeLessonComment: (commentId) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters
    const url = `${PHP_API_URL}?action=like_comment&id=${encodeURIComponent(commentId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.post(url, {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },
  
  // QUIZ ENDPOINTS
  getQuiz: (lessonId) => {
    const token = authToken;
    
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    const url = `${PHP_API_URL}?action=get_quiz&lesson_id=${encodeURIComponent(lessonId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url).then(response => {
      return response;
    }).catch(error => {
      throw error;
    });
  },

  startQuizAttempt: (quizId) => {
    const token = authToken;
    
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    const url = `${PHP_API_URL}?action=start_quiz_attempt&quiz_id=${encodeURIComponent(quizId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url).then(response => {
      return response;
    }).catch(error => {
      throw error;
    });
  },

  submitQuizAttempt: (attemptId, answers) => {
    const token = authToken;
    
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    const url = `${PHP_API_URL}?action=submit_quiz_attempt&token=${encodeURIComponent(token)}`;
    
    const requestData = {
      attempt_id: attemptId,
      answers: answers // Send answers as JSON object, not stringified
    };
    
    return axiosInstance.post(url, requestData, {
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(response => {
      return response;
    }).catch(error => {
      throw error;
    });
  },

  getQuizResults: (attemptId) => {
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    const url = `${PHP_API_URL}?action=get_quiz_results&attempt_id=${encodeURIComponent(attemptId)}&token=${encodeURIComponent(token)}`;
    return axiosInstance.get(url);
  },

  getUserQuizHistory: () => {
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    const url = `${PHP_API_URL}?action=get_user_quiz_history&token=${encodeURIComponent(token)}`;
    return axiosInstance.get(url);
  },

  // Get user certificates
  getUserCertificates: () => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=get_user_certificates&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url);
  },

  // Get certificate details for viewing
  getCertificateDetails: (certificateId: string) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action, certificate_id and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=get_certificate_details&certificate_id=${encodeURIComponent(certificateId)}&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url);
  },

  // Request certificate for completed course
  requestCertificate: (courseId: string) => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=request_certificate&token=${encodeURIComponent(token)}`;
    
    // Send exactly as Postman does - JSON in request body with query param
    return axiosInstance.post(url, { course_id: courseId }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },

  // Get certificate PDF
  getCertificatePdf: (certificateId: string): AxiosPromise<ApiResponse> => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found')) as any;
    }
    
    // Build URL with action, certificate_id and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=generate_certificate_pdf&certificate_id=${encodeURIComponent(certificateId)}&token=${encodeURIComponent(token)}`;
    
    // Open in new tab
    window.open(url, '_blank');
    
    // Return a resolved promise
    return Promise.resolve({ data: { success: true, message: 'PDF opened in new tab' } }) as any;
  },

  // Get all categories
  getCategories: () => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=get_categories&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url);
  },

  // Get recent activity
  getRecentActivity: () => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=get_recent_activity&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url);
  },

  // Get user subscription status
  getUserSubscription: () => {
    // Get token from stored value
    const token = authToken;
    if (!token) {
      return Promise.reject(new Error('No authentication token found'));
    }
    
    // Build URL with action and token as query parameters (Postman format)
    const url = `${PHP_API_URL}?action=get_user_subscription&token=${encodeURIComponent(token)}`;
    
    return axiosInstance.get(url);
  },

};

export default api;
export type { ProfileData };
export { PHP_API_URL, getBaseUrl };
