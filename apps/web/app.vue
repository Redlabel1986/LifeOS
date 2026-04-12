<template>
  <Html :lang="locale" :dir="dir">
    <Body>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </Body>
  </Html>
</template>

<script setup lang="ts">
const { locale, locales } = useI18n();

const dir = computed(() => {
  const current = (locales.value as Array<{ code: string; dir?: string }>).find(
    (l) => l.code === locale.value,
  );
  return current?.dir ?? "ltr";
});
</script>
