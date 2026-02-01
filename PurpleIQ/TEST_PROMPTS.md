# 🧪 Test Prompts - Minimal Token Usage

## Overview
These are short, efficient test prompts that demonstrate functionality while using minimal API tokens.

---

## 📝 Test Cases Mode

### Ultra-Short (Best for Quick Tests)
```
Login form with username and password
```
**Expected Output**: 5-8 test cases
**Token Usage**: ~50-100 tokens

### Short
```
User can login with email and password. Password must be 8+ characters.
```
**Expected Output**: 8-12 test cases
**Token Usage**: ~100-200 tokens

### Medium
```
Feature: User Login
- Email field (required, valid format)
- Password field (min 8 chars, required)
- Remember me checkbox
- Submit button
```
**Expected Output**: 12-15 test cases
**Token Usage**: ~200-400 tokens

---

## 🤖 Automation Suggestions Mode

### Ultra-Short
```
Login page automation
```
**Expected Output**: Basic automation strategy
**Token Usage**: ~50-100 tokens

### Short
```
Automate login flow with email and password validation
```
**Expected Output**: Automation framework suggestions
**Token Usage**: ~100-200 tokens

### Medium
```
Need to automate:
- Login page
- Form validation
- Error messages
- Success redirect
```
**Expected Output**: Detailed automation approach
**Token Usage**: ~200-400 tokens

---

## 📊 Requirement Analysis Mode

### Ultra-Short
```
Payment checkout flow
```
**Expected Output**: Basic analysis
**Token Usage**: ~50-100 tokens

### Short
```
User can add items to cart and checkout with credit card
```
**Expected Output**: Requirements breakdown
**Token Usage**: ~100-200 tokens

### Medium
```
Shopping Cart Feature:
- Add/remove items
- Update quantities
- Calculate total
- Apply discount codes
- Checkout
```
**Expected Output**: Detailed analysis
**Token Usage**: ~200-400 tokens

---

## 📋 QA Summary Mode

### Ultra-Short
```
Test results: 10 passed, 2 failed
```
**Expected Output**: Brief QA summary
**Token Usage**: ~50-100 tokens

### Short
```
Sprint testing:
- 15 test cases executed
- 12 passed, 3 failed
- 2 critical bugs found
```
**Expected Output**: QA summary report
**Token Usage**: ~100-200 tokens

### Medium
```
Testing Summary:
- Module: User Authentication
- Test Cases: 20 total
- Pass Rate: 85%
- Critical Issues: 1
- Medium Issues: 2
```
**Expected Output**: Detailed QA summary
**Token Usage**: ~200-400 tokens

---

## 🎯 Recommended Quick Tests (For Demos)

### 1. **Super Fast Test** (~30 tokens)
**Mode**: Test Cases
**Input**:
```
Login button
```
**Time**: ~10-15 seconds
**Output**: 3-5 basic test cases

### 2. **Quick Demo** (~50 tokens)
**Mode**: Test Cases  
**Input**:
```
Search bar with submit button
```
**Time**: ~15-20 seconds
**Output**: 5-8 test cases

### 3. **Standard Demo** (~100 tokens)
**Mode**: Test Cases
**Input**:
```
User registration form:
- Name, email, password
- Terms checkbox
- Submit button
```
**Time**: ~20-30 seconds
**Output**: 10-12 test cases

### 4. **Full Demo** (~200 tokens)
**Mode**: Test Cases
**Input**:
```
E-commerce Product Page:
- Product image gallery
- Price and availability
- Size/color selector
- Add to cart button
- Product description
- Customer reviews
```
**Time**: ~30-40 seconds
**Output**: 15-20 test cases

---

## 💡 Token-Saving Tips

### 1. **Be Concise**
❌ Bad (verbose): "I need you to generate comprehensive test cases for a user authentication system that includes a login form with username and password fields, validation rules, and error handling"

✅ Good (concise): "Login form: username, password, validation"

### 2. **Use Bullet Points**
Instead of paragraphs, use bullets:
```
- Login field
- Password field  
- Submit button
```

### 3. **Remove Unnecessary Words**
❌ "Please generate test cases for..."
✅ "Login page"

### 4. **Focus on Key Elements**
Only mention what's essential:
```
Shopping cart: add item, remove item, checkout
```

### 5. **Avoid Repetition**
❌ "Test the login, test the logout, test the password reset"
✅ "Login, logout, password reset"

---

## 📈 Token Usage Comparison

| Input Length | Approx Tokens | Output Tokens | Total Tokens | Generation Time |
|--------------|---------------|---------------|--------------|-----------------|
| 1 line | 10-20 | 100-200 | 110-220 | ~10-15s |
| 2-3 lines | 20-50 | 200-400 | 220-450 | ~15-20s |
| 4-6 lines | 50-100 | 400-800 | 450-900 | ~20-30s |
| 7-10 lines | 100-200 | 800-1500 | 900-1700 | ~30-40s |
| 10+ lines | 200+ | 1500+ | 1700+ | ~40-60s |

---

## 🚀 Speed Testing Examples

### Fastest (5-10 seconds)
```
Login
```

### Fast (10-15 seconds)
```
Login with email and password
```

### Normal (15-25 seconds)
```
User login:
- Email validation
- Password requirements
- Error handling
```

### Detailed (25-40 seconds)
```
User Authentication:
- Login form (email, password)
- Email validation rules
- Password strength requirements
- Remember me option
- Forgot password link
- Account lockout after 3 failures
```

---

## 🎬 Demo Sequence (Progressive)

Use these in order to show increasing complexity:

### Demo 1: Ultra-Fast
**Input**: `Search button`
**Time**: ~10s
**Shows**: Basic functionality

### Demo 2: Quick
**Input**: `User profile page`
**Time**: ~15s  
**Shows**: Simple features

### Demo 3: Standard
**Input**: `Shopping cart: add, remove, checkout`
**Time**: ~25s
**Shows**: Multiple features

### Demo 4: Complex
**Input**: 
```
E-commerce checkout:
- Cart summary
- Shipping info
- Payment method
- Order review
```
**Time**: ~35s
**Shows**: Full workflow

---

## 💰 Cost Optimization

### Gemini 2.5 Flash Pricing (as of 2026)
- **Input**: ~$0.10 per 1M tokens
- **Output**: ~$0.40 per 1M tokens

### Cost per Test (Approximate)

| Test Type | Input Tokens | Output Tokens | Cost |
|-----------|--------------|---------------|------|
| Ultra-Short | 20 | 200 | $0.00002 |
| Short | 50 | 400 | $0.00005 |
| Medium | 100 | 800 | $0.0001 |
| Long | 200 | 1500 | $0.0002 |
| Very Long | 500 | 3000 | $0.0005 |

**Recommendation**: Use **Short** tests (50-100 tokens) for most demos and development.

---

## 🧠 Smart Testing Strategy

### Development Testing
Use ultra-short prompts to test functionality:
```
Login → Profile → Logout
```

### Client Demos
Use short-medium prompts for impressive output:
```
User dashboard:
- Stats cards
- Activity feed
- Quick actions
```

### Production Testing
Use detailed prompts for comprehensive coverage:
```
Full user workflow:
[detailed requirements]
```

---

## ✅ Best Practices

1. **Start Small**: Test with 1-2 word prompts first
2. **Add Details Gradually**: Only add what's needed
3. **Use Keywords**: Focus on nouns and key actions
4. **Skip Pleasantries**: Don't say "please", "thank you", etc.
5. **Test Token Usage**: Monitor your API dashboard
6. **Reuse Prompts**: Save successful short prompts
7. **Batch Similar Tests**: Group related features

---

## 📊 Monitoring Token Usage

### Check Your Usage
1. Look at server console logs:
   ```
   Tokens used: 450 (prompt: 50, completion: 400)
   ```

2. Monitor API dashboard (Google AI Studio)

3. Track costs over time

### Optimization Goals
- **Development**: < 100 tokens per test
- **Demos**: < 500 tokens per test  
- **Production**: Optimize based on budget

---

## 🎯 Quick Reference Card

```
┌─────────────────────────────────────────┐
│  QUICK TEST PROMPTS (Copy & Paste)     │
├─────────────────────────────────────────┤
│  Ultra-Fast (10s):                      │
│    Login                                │
│                                         │
│  Fast (15s):                            │
│    Login with email                     │
│                                         │
│  Normal (25s):                          │
│    Login form: email, password, submit  │
│                                         │
│  Detailed (40s):                        │
│    User auth: login, validation, errors │
└─────────────────────────────────────────┘
```

---

**Status**: ✅ Ready to Use

**Recommended**: Use **Short** prompts (2-3 lines, ~50-100 tokens) for best balance of speed, cost, and output quality.

