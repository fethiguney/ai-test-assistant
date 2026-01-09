# Feature Development Guide

Bu döküman yeni bir feature geliştirirken takip edilecek adımları içerir.

## 📋 Feature Checklist

### Başlamadan Önce

```
□ Feature requirement'ı anladım
□ Etkilenecek modülleri belirledim
□ Mevcut koda bakıp pattern'leri anladım
□ Breaking change olup olmayacağını kontrol ettim
```

### Development Süreci

```
□ Types tanımladım (types/ klasörü)
□ Service/Provider yazdım
□ API endpoint ekledim (gerekirse)
□ Validation schema yazdım
□ Error handling ekledim
□ Test ettim
```

### Kod Review

```
□ SOLID prensipleri uygulandı
□ Clean code kuralları takip edildi
□ Gereksiz complexity yok
□ Documentation eklendi
```

---

## 🏗️ Adım Adım Feature Geliştirme

### 1. Types Tanımlama

Önce interface'leri tanımla:

```typescript
// types/new-feature.types.ts

export interface NewFeatureRequest {
  // Input tipi
}

export interface NewFeatureResponse {
  // Output tipi
}

export interface INewFeatureService {
  // Service interface
  execute(request: NewFeatureRequest): Promise<NewFeatureResponse>;
}
```

### 2. Service Oluşturma

Business logic'i service'e yaz:

```typescript
// services/new-feature.service.ts

import { INewFeatureService, NewFeatureRequest, NewFeatureResponse } from '../types/index.js';

export class NewFeatureService implements INewFeatureService {
  constructor(
    private readonly dependency: IDependency  // DI
  ) {}

  async execute(request: NewFeatureRequest): Promise<NewFeatureResponse> {
    // Validation
    this.validate(request);
    
    // Business logic
    const result = await this.process(request);
    
    return result;
  }

  private validate(request: NewFeatureRequest): void {
    // Guard clauses
  }

  private async process(request: NewFeatureRequest): Promise<NewFeatureResponse> {
    // Implementation
  }
}

// Factory
export function createNewFeatureService(dependency: IDependency): NewFeatureService {
  return new NewFeatureService(dependency);
}
```

### 3. API Route Ekleme

HTTP endpoint:

```typescript
// api/routes/new-feature.routes.ts

import { Router } from 'express';
import { asyncHandler, validators } from '../middleware/index.js';
import { createNewFeatureService } from '../../services/index.js';

const router = Router();

router.post(
  '/execute',
  validators.newFeature,
  asyncHandler(async (req, res) => {
    const service = createNewFeatureService(dependencies);
    const result = await service.execute(req.body);
    res.json(result);
  })
);

export { router as newFeatureRoutes };
```

### 4. Validation Schema

Zod ile input validation:

```typescript
// api/middleware/validator.ts - schemas objesine ekle

newFeature: z.object({
  field1: z.string().min(1),
  field2: z.number().positive().optional(),
}),
```

### 5. Route Mounting

Ana index.ts'e ekle:

```typescript
// index.ts
import { newFeatureRoutes } from './api/routes/index.js';

app.use('/api/new-feature', newFeatureRoutes);
```

### 6. Module Export

```typescript
// services/index.ts
export { NewFeatureService, createNewFeatureService } from './new-feature.service.js';

// types/index.ts
export * from './new-feature.types.js';
```

---

## 📂 File Naming Convention

| Tip | Pattern | Örnek |
|-----|---------|-------|
| Type definitions | `*.types.ts` | `test.types.ts` |
| Service | `*.service.ts` | `test-generator.service.ts` |
| Provider | `*.provider.ts` | `ollama.provider.ts` |
| Routes | `*.routes.ts` | `llm.routes.ts` |
| Middleware | Descriptive name | `error-handler.ts` |
| Config | `index.ts` in config/ | `config/index.ts` |

---

## 🔗 Dependency Chain

```
Types → Services → Routes → Index
  ↓         ↓
Config    Middleware
```

- Types: Hiçbir şeye bağımlı değil
- Services: Types ve Config'e bağımlı
- Routes: Services, Types ve Middleware'e bağımlı
- Index: Her şeyi birleştirir

---

## ⚡ Quick Reference

### Yeni Provider Ekleme
1. `llm/providers/new.provider.ts` oluştur
2. `BaseLLMProvider`'ı extend et
3. `providers/index.ts`'e export ekle
4. `LLMManager`'a register et

### Yeni Service Ekleme
1. `services/new.service.ts` oluştur
2. Constructor'da dependency al (DI)
3. Factory function yaz
4. `services/index.ts`'e export ekle

### Yeni Route Ekleme
1. `api/routes/new.routes.ts` oluştur
2. Validators kullan
3. asyncHandler wrap et
4. `routes/index.ts`'e export ekle
5. `index.ts`'e mount et
