<template>
  <main class="container mx-auto p-8 text-dnd-parchment">
    <template v-if="activeLesson">
      <h1 class="text-3xl text-dnd-gold">{{ activeLesson.title }} lesson</h1>
      <p class="my-4">{{ activeLesson.description }}</p>
      <p>No client certificate is required. Complete sign-in on the identity provider’s page.</p>
      <p v-if="activeLesson.id === 'passkeys'" class="my-4"><a href="/teaching/passkeys/enroll" class="text-dnd-gold">Enroll a passkey first</a></p>
      <p v-if="lesson.error.value" role="alert" class="my-4">{{ lesson.error.value }}</p>
      <section v-if="lesson.identity.value" class="my-6" aria-label="Authenticated lesson identity">
        <h2>{{ activeLesson.id === 'passkeys-enroll' ? 'Enrollment session completed' : 'Lesson sign-in accepted' }}</h2>
        <dl>
          <dt>Account</dt><dd :data-testid="activeLesson.id === 'password-otp' ? 'otp-user' : 'lesson-user'">{{ lesson.identity.value.username }}</dd>
          <dt>Token subject</dt><dd data-testid="lesson-subject">{{ lesson.identity.value.subject }}</dd>
        </dl>
        <p>This lesson does not grant access to shop records.</p>
        <button class="my-6 text-dnd-gold" type="button" @click="signOut">Sign out of lesson</button>
        <p v-if="activeLesson.id === 'passkeys-enroll'"><a href="/teaching/passkeys" class="text-dnd-gold">Test passkey sign-in</a></p>
      </section>
      <button v-else class="my-6 text-dnd-gold" type="button" :disabled="lesson.busy.value" @click="signIn">{{ activeLesson.button }}</button>
      <p><a href="/teaching" class="text-dnd-gold">All authentication lessons</a></p>
    </template>
    <template v-else>
      <h1 class="text-3xl text-dnd-gold">Authentication lessons</h1>
      <p class="my-4">Explore different ways to sign in. Certificate-free lessons use this separate entrance.</p>
      <ul class="my-6 space-y-4">
        <li v-for="entry in publicLessons" :key="entry.id"><a :href="entry.path" class="text-dnd-gold">{{ entry.title }}</a></li>
        <li><a href="https://shop.magic.test:8443/teaching/certificate-password" class="text-dnd-gold">Certificate + password</a> — requires an installed user certificate.</li>
        <li><a href="https://shop.magic.test:8443/" class="text-dnd-gold">Certificate-only shop</a> — requires an installed user certificate.</li>
      </ul>
      <p>Federation and Kerberos lessons need their provider services running. Ask your lab operator to start the authentication lesson stack.</p>
    </template>
  </main>
</template>

<script setup lang="ts">
import { lesson, activeLesson, signIn, signOut } from './session';
import { lessons } from './lessons';
const publicLessons = lessons.filter(value => value.id !== 'passkeys-enroll');
</script>
