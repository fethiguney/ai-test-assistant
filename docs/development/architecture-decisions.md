# Architecture Decision Records (ADR)

Bu döküman projedeki mimari kararları ve gerekçelerini içerir.

---

## ADR-001: TypeScript + Node.js Kullanımı

**Tarih:** 2026-01-09
**Durum:** Kabul Edildi

### Bağlam
Backend teknolojisi seçilmeliydi.

### Karar
TypeScript + Node.js kullanılacak.

### Gerekçe
- Playwright native Node.js desteği
- MCP SDK TypeScript için yazılmış
- LLM API çağrıları I/O-bound (Node.js optimize)
- Full-stack JS ile frontend entegrasyonu kolay
- Mevcut ekip deneyimi

### Sonuçlar
- ✅ Playwright entegrasyonu sorunsuz
- ✅ Type safety
- ⚠️ CPU-intensive işlemler için optimal değil (ama bu projede yok)

---

## ADR-002: Express.js API Framework

**Tarih:** 2026-01-09
**Durum:** Kabul Edildi

### Bağlam
HTTP API framework seçilmeliydi.

### Karar
Express.js kullanılacak.

### Gerekçe
- Basit ve minimal
- Geniş middleware ekosistemi
- Ekip deneyimi
- Production-ready

### Alternatifler
- Fastify: Daha hızlı ama daha az middleware
- Koa: Daha modern ama daha az popüler
- NestJS: Overkill bu proje için

---

## ADR-003: LLM Provider Abstraction

**Tarih:** 2026-01-09
**Durum:** Kabul Edildi

### Bağlam
Birden fazla LLM provider desteklenmeli.

### Karar
- `ILLMProvider` interface tanımlandı
- `BaseLLMProvider` abstract class oluşturuldu
- Her provider bu class'ı extend ediyor

### Gerekçe
- Open/Closed Principle
- Yeni provider eklemek kolay
- Runtime'da provider değiştirilebilir

### Yapı
```
ILLMProvider (interface)
     ↑
BaseLLMProvider (abstract)
     ↑
┌────┴────┐
Ollama    Groq
```

---

## ADR-004: Modular Folder Structure

**Tarih:** 2026-01-09
**Durum:** Kabul Edildi

### Bağlam
Proje yapısı belirlenmeliydi.

### Karar
Feature-based modular yapı:

```
src/
├── config/      # Merkezi konfigürasyon
├── types/       # Type definitions
├── llm/         # LLM modülü
├── services/    # Business logic
├── api/         # HTTP layer
│   ├── middleware/
│   └── routes/
└── index.ts     # Entry point
```

### Gerekçe
- Her modül bağımsız
- Import/export kontrollü (index.ts)
- Kolay test edilebilir
- Kolay navigate edilebilir

---

## ADR-005: Zod Validation

**Tarih:** 2026-01-09
**Durum:** Kabul Edildi

### Bağlam
Request validation gerekli.

### Karar
Zod kullanılacak.

### Gerekçe
- TypeScript ile mükemmel entegrasyon
- Runtime validation + static types
- Declarative syntax
- İyi hata mesajları

### Örnek
```typescript
const schema = z.object({
  scenario: z.string().min(1),
  context: z.object({
    pageType: z.string().optional(),
  }).optional(),
});
```

---

## ADR-006: Centralized Error Handling

**Tarih:** 2026-01-09
**Durum:** Kabul Edildi

### Bağlam
Error handling standardize edilmeliydi.

### Karar
- Custom Error class'ları (`AppError`, `ValidationError`, `LLMError`)
- Merkezi error handler middleware
- `asyncHandler` wrapper for async routes

### Gerekçe
- Tutarlı error response format
- Tek noktadan error logging
- Route handler'lar temiz kalıyor

---

## ADR-007: Dependency Injection Pattern

**Tarih:** 2026-01-09
**Durum:** Kabul Edildi

### Bağlam
Class'lar arası bağımlılık yönetimi.

### Karar
- Constructor injection
- Factory functions

### Gerekçe
- Testability (mock injection)
- Loose coupling
- Explicit dependencies

### Örnek
```typescript
class TestGeneratorService {
  constructor(private readonly llmManager: LLMManager) {}
}

// Factory
export function createTestGeneratorService(llmManager: LLMManager) {
  return new TestGeneratorService(llmManager);
}
```

---

## ADR-008: Groq as Primary LLM Provider

**Tarih:** 2026-01-09
**Durum:** Kabul Edildi

### Bağlam
Primary LLM provider seçilmeliydi.

### Karar
Development için Groq tercih edilecek (Ollama yedek).

### Gerekçe
- Çok hızlı (200ms vs 70s)
- Ücretsiz tier yeterli (30 req/min)
- Llama 3.3 70B modeli kaliteli
- OpenAI compatible API

### Trade-offs
- ✅ Hız: 180x daha hızlı
- ✅ Maliyet: Ücretsiz
- ⚠️ Internet bağımlılığı
- ⚠️ Rate limit var

---

## Template: Yeni ADR

```markdown
## ADR-XXX: [Başlık]

**Tarih:** YYYY-MM-DD
**Durum:** Önerildi | Kabul Edildi | Reddedildi | Deprecated

### Bağlam
[Problem/durum açıklaması]

### Karar
[Ne kararlaştırıldı]

### Gerekçe
[Neden bu karar verildi]

### Alternatifler
[Değerlendirilen diğer seçenekler]

### Sonuçlar
[Kararın pozitif/negatif etkileri]
```
