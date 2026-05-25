<script lang="ts">
  import { Loader2, Mail, Send } from 'lucide-svelte';

  type Status = 'idle' | 'submitting' | 'success' | 'error';

  let name = '';
  let email = '';
  let subject = '';
  let message = '';
  // Honeypot field — must remain empty. Hidden from real users via CSS,
  // but bots that auto-fill every input will tip themselves off.
  let website = '';

  let status: Status = 'idle';
  let errorMessage = '';

  async function handleSubmit(): Promise<void> {
    if (status === 'submitting') return;

    if (name.trim().length < 2) {
      status = 'error';
      errorMessage = 'Please enter your name.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      status = 'error';
      errorMessage = 'Please enter a valid email address.';
      return;
    }
    if (message.trim().length < 10) {
      status = 'error';
      errorMessage = 'Share a few more details so we can help.';
      return;
    }

    status = 'submitting';
    errorMessage = '';

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          website
        })
      });

      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !body.ok) {
        status = 'error';
        errorMessage =
          body.error ||
          'We could not send your message right now. Please try again or email huntflow@xalgorix.com.';
        return;
      }

      status = 'success';
      name = '';
      email = '';
      subject = '';
      message = '';
    } catch (err) {
      console.error('[v0] contact submit failed', err);
      status = 'error';
      errorMessage =
        'Network error. Please check your connection or email huntflow@xalgorix.com.';
    }
  }

  function reset(): void {
    status = 'idle';
    errorMessage = '';
  }
</script>

<section
  id="contact"
  class="border-b border-zinc-800 bg-zinc-900 px-4 py-20 sm:px-6 lg:px-8"
>
  <div class="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.7fr_1.3fr]">
    <div>
      <p class="hf-eyebrow">Contact</p>
      <h2 class="mt-2 text-3xl font-bold leading-tight text-zinc-100 sm:text-4xl">
        Talk to a human at HuntFlow.
      </h2>
      <p class="mt-3 text-sm leading-6 text-zinc-400">
        Sales questions, self-host enquiries, bug reports, or just feedback. We read
        everything and reply fast.
      </p>
      <a
        href="mailto:huntflow@xalgorix.com"
        class="mt-5 inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
      >
        <Mail size={14} aria-hidden="true" />
        huntflow@xalgorix.com
      </a>
    </div>

    <div class="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-dark-sm sm:p-8">
      {#if status === 'success'}
        <div
          role="status"
          aria-live="polite"
          class="flex flex-col items-start gap-4 rounded-xl border border-primary-500/30 bg-primary-500/5 p-6"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/15 text-primary-300">
            <Mail size={18} aria-hidden="true" />
          </div>
          <div>
            <p class="text-base font-semibold text-zinc-100">Message sent.</p>
            <p class="mt-1 text-sm leading-6 text-zinc-400">
              Thanks for reaching out. We&apos;ll reply to your inbox shortly &mdash; usually
              within one business day.
            </p>
          </div>
          <button
            type="button"
            on:click={reset}
            class="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
          >
            Send another message
          </button>
        </div>
      {:else}
        <form
          class="grid gap-4"
          on:submit|preventDefault={handleSubmit}
          novalidate
          aria-busy={status === 'submitting'}
        >
          <!-- Honeypot. Real users never see this — bots filling every input
               flag themselves and their submission is silently swallowed. -->
          <div aria-hidden="true" class="hidden">
            <label for="contact-website">Website</label>
            <input
              id="contact-website"
              type="text"
              name="website"
              tabindex="-1"
              autocomplete="off"
              bind:value={website}
            />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="grid gap-1.5">
              <label for="contact-name" class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                Name
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                autocomplete="name"
                required
                maxlength="120"
                bind:value={name}
                disabled={status === 'submitting'}
                class="min-h-[44px] rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-primary-500/60 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-60"
                placeholder="Your name"
              />
            </div>
            <div class="grid gap-1.5">
              <label for="contact-email" class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                Email
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                autocomplete="email"
                required
                maxlength="254"
                bind:value={email}
                disabled={status === 'submitting'}
                class="min-h-[44px] rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-primary-500/60 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-60"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div class="grid gap-1.5">
            <label for="contact-subject" class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Subject <span class="font-normal normal-case tracking-normal text-zinc-500">(optional)</span>
            </label>
            <input
              id="contact-subject"
              name="subject"
              type="text"
              maxlength="200"
              bind:value={subject}
              disabled={status === 'submitting'}
              class="min-h-[44px] rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-primary-500/60 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-60"
              placeholder="Self-host access, billing, bug report..."
            />
          </div>

          <div class="grid gap-1.5">
            <label for="contact-message" class="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Message
            </label>
            <textarea
              id="contact-message"
              name="message"
              required
              maxlength="5000"
              rows="6"
              bind:value={message}
              disabled={status === 'submitting'}
              class="min-h-[140px] resize-y rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm leading-6 text-zinc-100 placeholder:text-zinc-500 focus:border-primary-500/60 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-60"
              placeholder="Tell us what you&apos;re trying to do, or what went wrong."
            ></textarea>
          </div>

          {#if status === 'error' && errorMessage}
            <p
              role="alert"
              class="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-200"
            >
              {errorMessage}
            </p>
          {/if}

          <div class="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-xs leading-5 text-zinc-500">
              We use your email only to reply. No newsletters, no tracking pixels.
            </p>
            <button
              type="submit"
              disabled={status === 'submitting'}
              class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {#if status === 'submitting'}
                <Loader2 size={16} class="animate-spin" aria-hidden="true" />
                Sending...
              {:else}
                <Send size={16} aria-hidden="true" />
                Send message
              {/if}
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>
</section>
