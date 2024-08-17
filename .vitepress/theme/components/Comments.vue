<template>
  <div class="comments">
    <!-- params generate in https://giscus.app/zh-CN -->
    <Giscus
        repo="zhiyu1998/rconsole-plugin"
        repo-id="R_kgDOLNdlcQ"
        category="Q&A"
        category-id="DIC_kwDOLNdlcc4ChqqQ"
        mapping="pathname"
        strict="1"
        reactions-enabled="1"
        emit-metadata="0"
        input-position="top"
        :theme="theme"
        lang="zh-CN"
        loading="lazy"
        crossorigin="anonymous"
    />
  </div>
</template>
<script lang="ts" setup>
import { useData, useRoute } from "vitepress";
import Giscus from "@giscus/vue";

const route = useRoute();
const { isDark } = useData();

const theme = computed(() => (isDark.value ? "dark_dimmed" : "light_high_contrast"));

</script>
<style scoped>
.comments {
  margin-top: 80px;
}
</style>
