<script lang="ts">
  import { page } from '$app/stores';
  import RouteRedirect from '$lib/components/layout/RouteRedirect.svelte';
</script>

<!-- The timeline is now the program's Activity tab. -->
<RouteRedirect to={`/programs/${$page.params.id}#activity`} label="the program's activity" />
