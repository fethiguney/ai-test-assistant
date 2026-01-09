# Refactoring Guide

Bu döküman kod refactoring yaparken takip edilecek prensipleri içerir.

## 🎯 Ne Zaman Refactor Yapmalı

### Red Flags (Kod Kokuları)

| Kod Kokusu | Belirti | Çözüm |
|------------|---------|-------|
| **Long Method** | 30+ satır fonksiyon | Extract Method |
| **Large Class** | 200+ satır class | Extract Class |
| **Duplicate Code** | Aynı kod 3+ yerde | Extract to shared function |
| **Long Parameter List** | 4+ parametre | Parameter Object |
| **Feature Envy** | Başka class'ın datası çok kullanılıyor | Move Method |
| **Divergent Change** | Bir class farklı nedenlerle değişiyor | Split by responsibility |
| **Shotgun Surgery** | Bir değişiklik çok dosyayı etkiliyor | Move/Consolidate |
| **Data Clumps** | Aynı field'lar birlikte dolaşıyor | Extract Class |
| **Primitive Obsession** | String/number her yerde | Value Objects |
| **Switch Statements** | Tekrarlayan switch/if-else | Polymorphism |

---

## 🔄 Refactoring Teknikleri

### 1. Extract Method

**Önce:**
```typescript
async function processTest(scenario: string) {
  // Validate
  if (!scenario) throw new Error('Required');
  if (scenario.length < 10) throw new Error('Too short');
  
  // Build prompt
  const systemPrompt = 'You are a QA engineer...';
  const userPrompt = `Convert: ${scenario}`;
  
  // Call LLM
  const response = await llm.generate(userPrompt, systemPrompt);
  
  // Parse
  const cleaned = response.replace(/```/g, '');
  const steps = JSON.parse(cleaned);
  
  return steps;
}
```

**Sonra:**
```typescript
async function processTest(scenario: string) {
  this.validateScenario(scenario);
  const prompts = this.buildPrompts(scenario);
  const response = await this.callLLM(prompts);
  return this.parseResponse(response);
}

private validateScenario(scenario: string): void {
  if (!scenario) throw new Error('Required');
  if (scenario.length < 10) throw new Error('Too short');
}

private buildPrompts(scenario: string): Prompts {
  return {
    system: 'You are a QA engineer...',
    user: `Convert: ${scenario}`,
  };
}

private async callLLM(prompts: Prompts): Promise<string> {
  return this.llm.generate(prompts.user, prompts.system);
}

private parseResponse(response: string): TestStep[] {
  const cleaned = response.replace(/```/g, '');
  return JSON.parse(cleaned);
}
```

### 2. Extract Class

**Önce:**
```typescript
class LLMManager {
  // Provider management
  registerProvider() {}
  getProvider() {}
  
  // Test generation - Bu ayrı class olmalı
  generateTestSteps() {}
  buildPrompt() {}
  parseSteps() {}
  
  // Validation - Bu da ayrı olabilir
  validateSteps() {}
  validateProvider() {}
}
```

**Sonra:**
```typescript
// llm-manager.ts - Sadece provider yönetimi
class LLMManager {
  registerProvider() {}
  getProvider() {}
}

// test-generator.service.ts - Sadece test üretimi
class TestGeneratorService {
  generateTestSteps() {}
  buildPrompt() {}
  parseSteps() {}
}

// validator.service.ts - Sadece validation
class ValidatorService {
  validateSteps() {}
  validateProvider() {}
}
```

### 3. Replace Conditional with Polymorphism

**Önce:**
```typescript
function processAction(step: TestStep) {
  if (step.action === 'click') {
    await page.click(step.target);
  } else if (step.action === 'fill') {
    await page.fill(step.target, step.value);
  } else if (step.action === 'goto') {
    await page.goto(step.target);
  } else if (step.action === 'expectVisible') {
    await expect(page.locator(step.target)).toBeVisible();
  }
  // Her yeni action için if eklemek gerekiyor...
}
```

**Sonra:**
```typescript
// Action interface
interface IStepAction {
  execute(page: Page, step: TestStep): Promise<void>;
}

// Concrete implementations
class ClickAction implements IStepAction {
  async execute(page: Page, step: TestStep) {
    await page.click(step.target);
  }
}

class FillAction implements IStepAction {
  async execute(page: Page, step: TestStep) {
    await page.fill(step.target, step.value);
  }
}

// Action registry
const actions: Map<string, IStepAction> = new Map([
  ['click', new ClickAction()],
  ['fill', new FillAction()],
  ['goto', new GotoAction()],
]);

// Usage - yeni action eklemek için sadece Map'e ekle
function processAction(step: TestStep) {
  const action = actions.get(step.action);
  if (!action) throw new Error(`Unknown action: ${step.action}`);
  await action.execute(page, step);
}
```

### 4. Introduce Parameter Object

**Önce:**
```typescript
function generateSteps(
  scenario: string,
  pageType: string,
  allowedActions: string[],
  baseUrl: string,
  timeout: number,
  retryCount: number
) {
  // ...
}
```

**Sonra:**
```typescript
interface GenerateStepsOptions {
  scenario: string;
  context?: {
    pageType?: string;
    allowedActions?: string[];
    baseUrl?: string;
  };
  options?: {
    timeout?: number;
    retryCount?: number;
  };
}

function generateSteps(options: GenerateStepsOptions) {
  const { scenario, context, options: opts } = options;
  // ...
}
```

---

## 📝 Refactoring Checklist

### Başlamadan Önce
```
□ Mevcut kod çalışıyor mu? (Test et)
□ Ne değiştireceğimi biliyorum
□ Küçük adımlarla ilerleyeceğim
□ Her adımda test edeceğim
```

### Refactoring Sırasında
```
□ Bir seferde tek bir değişiklik
□ Davranış değişmiyor, sadece yapı
□ İsimlendirmeler düzeltildi
□ Gereksiz kod silindi
```

### Bitirdikten Sonra
```
□ Tüm testler geçiyor
□ Kod daha okunabilir
□ SOLID prensipleri uygulandı
□ Gereksiz abstraction yok
```

---

## ⚠️ Refactoring Antipatterns

### 1. Big Bang Refactoring
❌ Her şeyi bir seferde değiştirmeye çalışmak
✅ Küçük, incremental değişiklikler

### 2. Refactoring Without Tests
❌ Test olmadan refactor yapmak
✅ Önce test, sonra refactor

### 3. Over-Engineering
❌ "Gelecekte lazım olur" diye abstraction eklemek
✅ YAGNI - Şu an gerekeni yap

### 4. Premature Abstraction
❌ İlk tekrarda abstraction yapmak
✅ Rule of Three - 3. tekrarda abstract et

### 5. Refactoring and Adding Features Together
❌ Aynı anda hem refactor hem feature
✅ Önce refactor, commit, sonra feature

---

## 🔧 Bu Projede Refactoring Örnekleri

### Örnek 1: LLMManager'dan TestGenerator Ayrılması

**Neden:** Single Responsibility ihlali
**Nasıl:** Test generation logic'i `TestGeneratorService`'e taşındı
**Sonuç:** LLMManager sadece provider yönetimi yapıyor

### Örnek 2: Routes Modülerleştirme

**Neden:** index.ts çok büyüdü (100+ satır)
**Nasıl:** Her route grubu ayrı dosyaya taşındı
**Sonuç:** 
- `health.routes.ts`
- `llm.routes.ts`
- `test.routes.ts`

### Örnek 3: Provider'ları Klasöre Taşıma

**Neden:** llm/ klasörü karışık
**Nasıl:** Provider'lar `llm/providers/` altına taşındı
**Sonuç:** Daha organize yapı
