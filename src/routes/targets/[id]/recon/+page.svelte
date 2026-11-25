<script lang="ts">
  import { page } from '$app/stores';
  import RouteRedirect from '$lib/components/layout/RouteRedirect.svelte';
</script>

<!-- Recon assets live on the Targets page, which also handles imports. -->
<RouteRedirect to={`/targets?program=${$page.params.id}`} label="Targets" />
