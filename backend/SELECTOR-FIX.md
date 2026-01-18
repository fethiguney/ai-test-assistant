# Selector Generation Fix - Invalid CSS Classes

## Problem

**Error reported:**
```
Error: page.click: SyntaxError: Failed to execute 'querySelectorAll' on 'Document': 
'.focus:outline-none' is not a valid selector
```

**Scenario:** "navigate to https://www.europcar.com.tr/en and accept cookie policy"

### Root Cause

The selector generation code was extracting CSS class names directly from elements without validating or escaping them. When encountering **Tailwind CSS** classes like `focus:outline-none`, it created an invalid selector `.focus:outline-none`.

**The colon (`:`) in CSS has special meaning** (pseudo-classes like `:hover`, `:focus`), so it must be escaped when used in a class name: `.focus\:outline-none`.

However, **escaping is complex and error-prone**. Better solution: **avoid problematic classes entirely**.

## Solution

### 1. Added CSS Class Validation
**File:** `backend/src/websocket/websocket-test-orchestrator.ts`

Added a safety check to skip classes with special characters:

```javascript
function isSafeCSSClass(className) {
  // Avoid classes with special chars that need escaping
  return !/[:\/\[\]@!#]/.test(className);
}
```

### 2. Updated Selector Priority
Changed the selector generation strategy to prioritize stable, safe selectors:

**New Priority Order:**
1. ✅ `data-testid` - Most reliable
2. ✅ `id` - Unique identifier
3. ✅ `aria-label` - Accessibility attribute
4. ✅ `name` - Form field names
5. ✅ **`text="Button Text"`** - Text content for buttons/links (NEW!)
6. ✅ `.className` - Only if class is **safe** (no special chars)
7. ✅ `tag[role="..."]` - Tag with role attribute
8. ✅ `tag` - Tag name as last resort

**Key Change:** Text-based selectors now have **higher priority** than CSS classes.

### 3. Text-Based Selectors for Buttons
For buttons and links with visible text, we now prefer text selectors:

```javascript
// Priority 5: text content for buttons/links (more reliable than classes)
var text = (el.textContent || '').trim();
if ((el.tagName === 'BUTTON' || el.tagName === 'A' || 
     el.getAttribute('role') === 'button') && 
    text.length > 0 && text.length < 50) {
  return 'text="' + text + '"';
}
```

**Benefits:**
- ✅ More stable (text is visible to users)
- ✅ Works across CSS framework changes
- ✅ No special character issues
- ✅ More readable for humans

### 4. Updated LLM Prompt
**File:** `backend/src/services/test-generator.service.ts`

Added guidance about text selectors:

```
11. Selectors may be in different formats:
    - Attribute: [data-testid="..."], [aria-label="..."], [name="..."]
    - ID: #elementId
    - Text: text="Button Text" (for buttons/links)
    - Class: .className (only safe classes without special chars)
    - Tag+Role: button[role="button"]
12. ALWAYS prefer text="..." selectors for buttons with visible text
```

## Examples

### Before Fix (BROKEN)

Europcar cookie dialog button:
```html
<button class="focus:outline-none hover:bg-green-600 ...">Accept Cookies</button>
```

Generated selector: `.focus:outline-none` ❌
**Error:** `SyntaxError: '.focus:outline-none' is not a valid selector`

### After Fix (WORKING)

Same button, better selector strategy:

**Option 1: Text selector (preferred)**
```
text="Accept Cookies" ✅
```

**Option 2: Safe class (if text unavailable)**
If classes were: `btn-primary accept-button focus:outline-none`
- Skip: `focus:outline-none` (has `:`)
- Use: `.btn-primary` ✅

**Option 3: Tag + role**
```
button[role="button"] ✅
```

## Testing

### Test Script
Run the Europcar test:
```bash
cd backend
npx tsx src/test-europcar-cookie.ts
```

### Expected Output
```
✨ STEP 1 GENERATED:
   Action: goto
   Target: https://www.europcar.com.tr/en

📸 SNAPSHOT 1 CAPTURED:
   Elements: 127
   ✅ Found 1 cookie button(s):
      - Selector: text="Accept Cookies"  ← TEXT SELECTOR!
        Text: "Accept Cookies"

✨ STEP 2 GENERATED:
   Action: click
   Target: text="Accept Cookies"  ← SAFE SELECTOR!
   ✅ Selector format validated

✅ STEP EXECUTED:
   Action: click
   Status: PASSED  ← NO ERROR!
```

### Verification Checklist

- ✅ No selectors starting with `.` followed by special chars (`:`, `/`, `[`, `]`, `@`, `!`, `#`)
- ✅ Text selectors used for buttons with visible text
- ✅ No `SyntaxError: not a valid selector` errors
- ✅ Cookie accept button clicks successfully

## Common Selector Issues Fixed

### Tailwind CSS Classes
```
❌ .focus:outline-none
❌ .hover:bg-blue-500
❌ .sm:flex
❌ .lg:w-1/2
❌ .before:content-['']

✅ text="Click Me" (preferred)
✅ .btn-primary (if no special chars)
✅ [data-testid="submit-btn"]
✅ button[role="button"]
```

### Bootstrap Classes (Safe)
```
✅ .btn-primary
✅ .form-control
✅ .nav-link
(No special characters, work fine)
```

### Material-UI / Emotion (Generated Classes)
```
❌ .css-1dbjc4n (generated, unstable)
✅ [aria-label="Submit"]
✅ text="Submit"
```

## Benefits of the Fix

1. **Stability** - Text selectors don't break when CSS changes
2. **Compatibility** - Works with any CSS framework (Tailwind, Bootstrap, etc.)
3. **Reliability** - No CSS selector syntax errors
4. **Readability** - `text="Accept Cookies"` is clearer than `.btn-accept-cookies-123`
5. **Accessibility** - Encourages use of aria-labels and semantic HTML

## Implementation Details

### Selector Safety Rules

```javascript
// UNSAFE classes (will be skipped):
- Contains `:` (e.g., focus:outline-none)
- Contains `/` (e.g., w-1/2)
- Contains `[` or `]` (e.g., before:content-['x'])
- Contains `@` (e.g., screen@md)
- Contains `!` (e.g., !important-class)
- Contains `#` (e.g., color-#fff)

// SAFE classes (can be used):
- Only alphanumeric, dash, underscore
- Examples: btn-primary, form-control, my-button
```

### Text Selector Format

Playwright supports:
```javascript
page.click('text="Exact Text"')  // Exact match with quotes
page.click('text=PartialText')   // Partial match without quotes
```

We use the quoted format for exact matches: `text="Accept Cookies"`

## Rollout

1. ✅ Update `websocket-test-orchestrator.ts` - Selector generation
2. ✅ Update `test-generator.service.ts` - LLM prompt
3. ✅ Create test script `test-europcar-cookie.ts`
4. ✅ Document in `SELECTOR-FIX.md`

## No Changes Required In

- ✅ `step-executor.service.ts` - Already supports text selectors via `page.click(selector)`
- ✅ Frontend - No changes needed
- ✅ Type definitions - No changes needed

Playwright's built-in support for text selectors means no executor changes required!

## Summary

**Problem:** Invalid CSS selectors with unescaped special characters (Tailwind CSS)
**Solution:** Validate classes, prefer text selectors for buttons
**Result:** No more selector syntax errors, more stable tests

The fix is **backward compatible** - existing valid selectors continue to work, but now we avoid generating invalid ones.
