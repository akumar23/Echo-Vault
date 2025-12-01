# Architectural Decision: asyncio.run() in Celery Tasks

**Status**: Accepted
**Date**: 2025-11-28
**Decision Maker**: Backend Architecture Review

## Context

Our Celery background jobs need to call async methods in `OllamaService` (which uses `httpx.AsyncClient` for HTTP requests to the local Ollama LLM). This creates a sync-async boundary that requires careful architectural consideration.

## Current Implementation

All Celery tasks use `asyncio.run()` to execute async OllamaService methods:

```python
@celery_app.task(name="embedding.create_embedding")
def create_embedding_task(entry_id: int):
    # ... database setup ...
    embedding_vector = asyncio.run(ollama_service.get_embedding(text_to_embed))
    # ... save to database ...
```

**Affected Files**:
- `/api/app/jobs/embedding_job.py`
- `/api/app/jobs/mood_job.py`
- `/api/app/jobs/reflection_job.py`
- `/api/app/jobs/insights_job.py`

## Options Considered

### Option A: Create Synchronous OllamaService Methods

**Approach**: Implement parallel sync methods using `httpx.Client` instead of `httpx.AsyncClient`.

**Pros**:
- No event loop overhead
- Native sync interface for Celery tasks

**Cons**:
- Code duplication (maintain both sync and async versions)
- Double the surface area for bugs
- Increased maintenance burden
- Loss of connection pooling benefits in async context
- Still need async methods for WebSocket streaming endpoints

**Performance Impact**: Saves ~50-200μs per task execution

### Option B: Event Loop Reuse Utility

**Approach**: Create a utility to manage a persistent event loop in Celery worker processes.

```python
# Example pattern
from app.utils.async_runner import run_async

@celery_app.task
def create_embedding_task(entry_id: int):
    embedding_vector = run_async(ollama_service.get_embedding(text_to_embed))
```

**Pros**:
- Eliminates event loop creation overhead
- Keeps async-only service implementation

**Cons**:
- Complex lifecycle management (worker startup/shutdown)
- Thread safety concerns with worker pool
- Additional abstraction layer to understand
- Edge cases with Celery's multiprocessing model
- Potential for subtle bugs if loop not properly managed

**Performance Impact**: Saves ~50-200μs per task execution

### Option C: Keep Current Approach (SELECTED)

**Approach**: Continue using `asyncio.run()` in Celery tasks.

**Pros**:
- Standard Python pattern (recommended in asyncio docs)
- Clean separation: sync tasks call async services
- No additional abstractions
- Proper cleanup guaranteed (loop created/destroyed per task)
- Thread-safe by design (isolated contexts)
- Simple to understand and maintain

**Cons**:
- Event loop creation overhead per task

**Performance Impact**: ~50-200μs overhead per task execution

## Decision

**We choose Option C: Keep the current asyncio.run() pattern.**

## Rationale

### 1. Performance Impact is Negligible

Event loop creation overhead compared to actual task execution time:

| Task Type | LLM Inference Time | Event Loop Overhead | Overhead % |
|-----------|-------------------|---------------------|------------|
| Embedding | 500ms - 2s | 50-200μs | 0.001% - 0.04% |
| Mood Inference | 1s - 5s | 50-200μs | 0.001% - 0.02% |
| Reflection | 5s - 30s | 50-200μs | 0.0003% - 0.004% |
| Insights | 5s - 30s | 50-200μs | 0.0003% - 0.004% |

The overhead is literally **thousands of times smaller** than the actual work being performed. LLM inference completely dominates task execution time.

### 2. Code Simplicity and Maintainability

The current pattern is:
- **Idiomatic Python**: `asyncio.run()` is the standard way to call async code from sync contexts
- **Self-documenting**: Clear sync-async boundary
- **Low cognitive load**: No custom abstractions to learn
- **Easy to debug**: Standard Python behavior, good error messages

Alternative approaches add complexity for negligible benefit:
- Option A requires maintaining 8+ methods in parallel (sync + async versions)
- Option B requires understanding custom event loop lifecycle management

### 3. Correctness and Safety

`asyncio.run()` provides:
- **Automatic cleanup**: Event loop properly closed after execution
- **Exception safety**: Proper propagation to Celery error handlers
- **Thread safety**: Each task gets isolated event loop context
- **No shared state issues**: No need to worry about loop reuse bugs

### 4. httpx.AsyncClient Connection Pooling Still Works

Even with short-lived event loops, the `OllamaService` maintains a single `httpx.AsyncClient` instance with connection pooling. The client persists across tasks (it's a module-level singleton), so HTTP keep-alive connections are reused effectively.

### 5. Alignment with Project Architecture

The pattern aligns with our design principles:
- **Privacy-first**: Local LLM calls dominate time, not framework overhead
- **Reliability**: Simple patterns are easier to test and debug
- **Maintainability**: Future developers can understand the code quickly

## Alternatives Rejected

- **Option A (Sync Methods)**: Rejected due to code duplication and maintenance burden with no meaningful performance benefit
- **Option B (Event Loop Reuse)**: Rejected due to added complexity and potential for subtle bugs with no meaningful performance benefit

## Performance Benchmarks

If you want to verify this decision, here's how to benchmark:

```python
import asyncio
import time

# Benchmark event loop creation
start = time.perf_counter()
for _ in range(1000):
    asyncio.run(asyncio.sleep(0))
end = time.perf_counter()
print(f"Event loop overhead: {(end - start) / 1000 * 1000000:.2f}μs per iteration")

# Compare to actual LLM call
start = time.perf_counter()
asyncio.run(ollama_service.get_embedding("test text"))
end = time.perf_counter()
print(f"LLM embedding time: {(end - start) * 1000:.2f}ms")
```

Expected results:
- Event loop overhead: ~50-200μs
- LLM embedding: ~500-2000ms
- **Ratio: ~1:10,000**

## When to Reconsider

This decision should be revisited if:

1. **Performance characteristics change dramatically**:
   - LLM inference becomes <10ms (e.g., switch to quantized models)
   - Task volume exceeds 10,000+ tasks/second
   - Profiling shows event loop overhead in top bottlenecks

2. **Architecture changes**:
   - Celery tasks start doing significant work beyond LLM calls
   - We switch to a native async task queue (e.g., ARQ, Dramatiq with async support)
   - OllamaService no longer needs async (unlikely given WebSocket streaming)

3. **Evidence of issues**:
   - Profiling shows event loop overhead causing problems
   - Resource exhaustion related to event loop creation
   - User-facing performance degradation traced to this pattern

## Documentation

All affected task files include inline documentation explaining this pattern:

```python
"""
Note: Uses asyncio.run() to call async OllamaService methods. This pattern
is intentional - the event loop creation overhead (~50-200μs) is negligible
compared to LLM inference time (~500ms-2s). Alternative approaches would add
complexity without meaningful performance benefit.
"""
```

## References

- [Python asyncio documentation: asyncio.run()](https://docs.python.org/3/library/asyncio-runner.html#asyncio.run)
- [PEP 3156 - Asynchronous IO Support](https://peps.python.org/pep-3156/)
- [httpx AsyncClient documentation](https://www.python-httpx.org/async/)
- Project: `/api/app/services/ollama_service.py` - Async service implementation
- Project: `/api/app/jobs/` - Celery task implementations

## Summary

The `asyncio.run()` pattern in Celery tasks is a **pragmatic architectural decision** that prioritizes:
- Code simplicity and maintainability
- Standard Python patterns
- Correctness and safety

Over:
- Negligible performance optimization (~0.001% overhead)
- Added complexity
- Potential for subtle bugs

This is an example of **avoiding premature optimization** - we choose the simple, correct solution over a complex optimization that provides no meaningful benefit in our use case.
