# Loading States Components

Beautiful, premium loading states and UI components for PurpleIQ.

## Components

### `AnimatedSpinner`
Animated loading spinner with customizable size and message.

**Props:**
- `size`: 'small' | 'medium' | 'large' (default: 'medium')
- `message`: string (default: 'Loading...')

**Usage:**
```jsx
<AnimatedSpinner size="large" message="Loading project..." />
```

### `SkeletonLoader`
Skeleton loader that shows layout structure while loading.

**Props:**
- `lines`: number (default: 3)
- `width`: string (default: '100%')

**Usage:**
```jsx
<SkeletonLoader lines={5} width="80%" />
```

### `AIProgressIndicator`
Multi-step progress indicator for AI generation with stage-specific messages and icons.

**Props:**
- `stage`: string (e.g., 'generating_test_cases', 'analyzing_documents')
- `progress`: number (0-100)
- `estimatedTime`: number (optional, seconds remaining)

**Usage:**
```jsx
<AIProgressIndicator 
  stage="generating_test_cases" 
  progress={60}
  estimatedTime={3}
/>
```

**Stages:**
- `initializing` - ⚙️ Initializing...
- `loading_context` - 📚 Loading project context...
- `classifying_intent` - 🎯 Analyzing your request...
- `generating_test_cases` - 🔍 Analyzing documents...
- `test_cases_complete` - ✨ Generating test cases...
- `complete` - ✅ Complete!

### `SuccessAnimation`
Animated checkmark with optional confetti effect.

**Props:**
- `message`: string (default: 'Success!')
- `showConfetti`: boolean (default: false)
- `onComplete`: function (optional callback)

**Usage:**
```jsx
<SuccessAnimation 
  message="Test cases generated!" 
  showConfetti={true}
/>
```

### `ConfettiEffect`
Confetti animation for celebrations.

**Usage:**
```jsx
<ConfettiEffect />
```

### `ErrorState`
Error display with retry button and help text.

**Props:**
- `message`: string (required)
- `details`: string (optional)
- `onRetry`: function (optional)
- `retryLabel`: string (default: 'Retry')
- `helpText`: string (optional)

**Usage:**
```jsx
<ErrorState
  message="Failed to load project"
  onRetry={() => loadProject()}
  retryLabel="Try Again"
  helpText="Check your connection"
/>
```

### `ProjectSkeleton`
Skeleton loader for project cards.

**Usage:**
```jsx
<ProjectSkeleton />
```

### `ChatMessageSkeleton`
Skeleton loader for chat messages.

**Usage:**
```jsx
<ChatMessageSkeleton />
```

## Features

- ✅ Smooth animations
- ✅ Color-coded progress stages
- ✅ Estimated time remaining
- ✅ Success celebrations
- ✅ Error recovery
- ✅ Responsive design
- ✅ Accessible (ARIA labels)

## Styling

All components use CSS animations and transitions for smooth, premium feel:
- Fade-in animations
- Slide-in animations
- Pulse effects
- Smooth color transitions
- Professional color scheme

