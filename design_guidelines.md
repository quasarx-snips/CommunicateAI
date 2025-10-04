# PostureSense: Multimodal Communication Analysis App - Design Guidelines

## Design Approach
**Reference-Based Approach**: Direct implementation of the provided PostureSense design mockups. The app prioritizes professional, clinical precision with a clean, accessible interface that builds trust for AI-powered analysis.

## Core Design Elements

### A. Color Palette

**Primary Colors:**
- Brand Blue (Header/Primary): 210 85% 45% - Professional blue for headers, primary buttons, and brand elements
- White Background: 0 0% 100% - Clean canvas for content sections
- Light Gray Background: 210 20% 98% - Subtle section dividers

**Text Colors:**
- Primary Text: 210 15% 20% - High contrast for body text
- Secondary Text: 210 10% 50% - Supporting information and labels
- Success Green: 140 60% 45% - Positive metrics and strengths
- Warning Orange: 30 90% 55% - Areas for improvement
- Accent Blue: 210 85% 55% - Interactive elements and highlights

### B. Typography

**Font Family**: Inter or System UI Stack
- Headings: 600-700 weight, tight letter-spacing
- Body: 400 weight, comfortable line-height (1.6)
- Metrics/Scores: 700 weight, larger sizing for emphasis

**Size Scale:**
- Hero Score: text-6xl (60px)
- Section Headings: text-2xl (24px)
- Card Titles: text-lg (18px)
- Body Text: text-base (16px)
- Labels: text-sm (14px)

### C. Layout System

**Spacing Units**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 24
- Component padding: p-6 to p-8
- Section spacing: py-12 to py-16
- Card gaps: gap-4 to gap-6

**Container Strategy:**
- Max-width: max-w-6xl for main content
- Page padding: px-4 (mobile) to px-8 (desktop)
- Single column layout for clarity and focus

### D. Component Library

**Header**
- Fixed blue background (210 85% 45%)
- White logo and "PostureSense" branding (text-xl, font-semibold)
- Height: h-16
- Shadow: shadow-md for depth

**Input Capture Section**
- Three prominent upload options: Photo Capture, Video Upload, Audio Recording
- Icon-based cards with rounded corners (rounded-xl)
- Hover state with subtle lift effect (hover:shadow-lg transition)
- Border: border-2 with border-gray-200

**Analysis Display**
- Large centered Overall Score with circular progress indicator
- Score displayed as percentage with descriptive label beneath
- Color-coded: Green (75-100%), Orange (50-74%), Red (0-49%)

**Detection Results Grid**
- Three icon cards: Pose Detection, Gesture Analysis, Hand Tracking
- Icons with colored backgrounds in circles
- Checkmark or status indicator per detection type
- Grid: grid-cols-1 md:grid-cols-3 with gap-6

**Insights Sections**
- Strengths: Green checkmark icons with bullet points
- Areas for Improvement: Orange warning icons with actionable items
- Recommendations: Blue lightbulb icons with specific guidance
- Card style: bg-white with border and rounded-lg, p-6

**Body Language Metrics**
- Horizontal percentage bars for: Confidence, Openness, Engagement, Stress Level
- Color-coded bars matching metric type
- Percentage labels at end of each bar
- Bar height: h-4, rounded-full with gradient fills

**Buttons**
- Primary: Blue background (210 85% 45%), white text, rounded-lg, px-6 py-3
- Secondary: White background with blue border, blue text
- Upload/Capture: Large touch-friendly areas with icons
- States: Hover brightness adjustment, active state scaling

### E. Visual Patterns

**Cards**
- White backgrounds with subtle shadow (shadow-sm)
- Rounded corners (rounded-xl)
- Consistent padding (p-6 to p-8)
- Border on hover for interactive cards

**Icons**
- Use Heroicons for consistency
- Size: w-6 h-6 for inline, w-12 h-12 for feature icons
- Colored backgrounds for primary icons (circles with brand colors)

**Progress Indicators**
- Circular progress for overall score
- Horizontal bars for individual metrics
- Smooth gradient fills
- Percentage labels prominently displayed

**Animations**
- Minimal, purposeful animations
- Fade-in for analysis results
- Progress bar fill animations (1-2 seconds)
- Subtle hover transforms (scale-105)

## Page Structure

**Homepage/Analysis View:**
1. Blue Header with PostureSense branding
2. Upload Section - 3-column grid of input options
3. Analysis Results Area (after processing):
   - Overall Score (large, centered)
   - Detection Results grid
   - Strengths section (green theme)
   - Areas for Improvement (orange theme)
   - Recommendations (blue theme)
   - Body Language Metrics bars
4. Historical Tracking (side-by-side comparison mode)

## Image Strategy
No hero images - This is a utility-focused professional tool. Visual hierarchy comes from:
- Clean iconography for upload states
- Analyzed media thumbnails with overlay annotations
- Data visualizations and progress indicators
- Icon-driven feature cards

## Accessibility
- High contrast ratios (WCAG AA minimum)
- Clear focus states on all interactive elements
- Large touch targets (min 44x44px)
- Screen reader friendly labels
- Keyboard navigation support