<template>
  <main class="container mx-auto p-8 text-dnd-parchment">
    <h1 class="text-3xl text-dnd-gold">Certificate + password lesson</h1>
    <p class="my-4">Present your installed client certificate, then enter that account’s password on Keycloak’s page. Both are required.</p>
    <p>Keycloak receives the password directly. This page holds the issued tokens in memory.</p>
    <p v-if="teaching.error.value" role="alert">{{ teaching.error.value }}</p>
    <section v-if="teaching.identity.value" class="my-6" aria-label="Authenticated teaching identity">
      <h2>Both factors accepted</h2>
      <dl>
        <dt>Account</dt><dd data-testid="teaching-user">{{ teaching.identity.value.username }}</dd>
        <dt>Token subject</dt><dd data-testid="teaching-subject">{{ teaching.identity.value.subject }}</dd>
        <dt>Certificate identity</dt><dd data-testid="teaching-certificate">{{ teaching.identity.value.certificateIdentity }}</dd>
      </dl>
      <button type="button" @click="signOutTeaching">Sign out of lesson</button>
    </section>
    <button v-else type="button" class="my-6 text-dnd-gold" :disabled="teaching.busy.value" @click="signInTeaching">Sign in with certificate and password</button>
    <p><a href="/" class="text-dnd-gold">Return to certificate-only shop</a></p>
  </main>
</template>

<script setup lang="ts">
import { teaching, signInTeaching, signOutTeaching } from './session';
</script>
