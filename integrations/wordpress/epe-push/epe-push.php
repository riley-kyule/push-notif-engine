<?php
/**
 * Plugin Name: Exotic Push Engine
 * Description: Browser push integration for Exotic WordPress sites.
 * Version: 0.1.0
 * Author: Exotic Online Advertising
 * Text Domain: exotic-push-engine
 */

if (!defined('ABSPATH')) {
    exit;
}

final class Exotic_Push_Engine_Plugin {
    private const OPTION_KEY      = 'epe_push_engine_settings';
    private const QUERY_VAR_PUSH_SW  = 'epe_push_sw';
    private const QUERY_VAR_MANIFEST = 'epe_push_manifest';

    public static function boot(): void {
        add_action('init', [__CLASS__, 'register_rewrites']);
        add_filter('query_vars', [__CLASS__, 'register_query_vars']);
        add_action('template_redirect', [__CLASS__, 'maybe_serve_assets']);
        add_action('wp_enqueue_scripts', [__CLASS__, 'enqueue_sdk']);
        add_filter('wp_inline_script_attributes', [__CLASS__, 'add_inline_script_nonce'], 10, 2);
        add_filter('script_loader_tag', [__CLASS__, 'add_script_tag_nonce'], 10, 2);
        add_action('wp_head', [__CLASS__, 'inject_manifest_link']);
        add_action('admin_menu', [__CLASS__, 'register_admin_menu']);
        add_action('admin_init', [__CLASS__, 'register_settings']);
        register_activation_hook(__FILE__, [__CLASS__, 'activate']);
        register_deactivation_hook(__FILE__, [__CLASS__, 'deactivate']);
    }

    public static function activate(): void {
        self::register_rewrites();
        flush_rewrite_rules();
    }

    public static function deactivate(): void {
        flush_rewrite_rules();
    }

    public static function register_rewrites(): void {
        add_rewrite_rule('^push-sw\.js$', 'index.php?' . self::QUERY_VAR_PUSH_SW . '=1', 'top');
        add_rewrite_rule('^manifest\.json$', 'index.php?' . self::QUERY_VAR_MANIFEST . '=1', 'top');
    }

    public static function register_query_vars(array $vars): array {
        $vars[] = self::QUERY_VAR_PUSH_SW;
        $vars[] = self::QUERY_VAR_MANIFEST;
        return $vars;
    }

    public static function maybe_serve_assets(): void {
        if ((int) get_query_var(self::QUERY_VAR_PUSH_SW) === 1) {
            self::serve_service_worker();
        }

        if ((int) get_query_var(self::QUERY_VAR_MANIFEST) === 1) {
            self::serve_manifest();
        }
    }

    private static function get_settings(): array {
        $defaults = [
            'api_url'         => '',
            'site_key'        => '',
        ];

        $stored = get_option(self::OPTION_KEY, []);
        if (!is_array($stored)) {
            $stored = [];
        }

        return array_merge($defaults, $stored);
    }

    private static function update_settings(array $settings): void {
        update_option(self::OPTION_KEY, $settings, false);
    }

    public static function enqueue_sdk(): void {
        $config = self::get_site_config();
        $script_url = plugins_url('assets/epe-sdk.js', __FILE__);

        wp_register_script('exotic-push-engine-sdk', $script_url, [], '0.1.0', true);
        wp_enqueue_script('exotic-push-engine-sdk');

        wp_add_inline_script(
            'exotic-push-engine-sdk',
            'window.ExoticPushEngineConfig = ' . wp_json_encode([
                'apiUrl'           => esc_url_raw((string) $config['api_url']),
                'siteKey'          => sanitize_text_field((string) $config['site_key']),
                'vapidPublicKey'   => sanitize_text_field((string) $config['vapid_public_key']),
                'serviceWorkerUrl' => home_url('/push-sw.js'),
                'manifestUrl'      => home_url('/manifest.json'),
                'iconUrl'          => esc_url_raw((string) $config['icon_url']),
                'appName'          => sanitize_text_field((string) $config['app_name']),
                'themeColor'       => sanitize_hex_color((string) $config['theme_color']) ?: '#1c1917',
                'optInPromptType'  => sanitize_text_field((string) $config['opt_in_prompt_type']),
                'optInPromptAnimation' => sanitize_text_field((string) $config['opt_in_prompt_animation']),
                'optInPromptBackgroundColor' => sanitize_text_field((string) $config['opt_in_prompt_background_color']),
                'optInPromptHeadline' => sanitize_text_field((string) $config['opt_in_prompt_headline']),
                'optInPromptHeadlineTextColor' => sanitize_text_field((string) $config['opt_in_prompt_headline_text_color']),
                'optInPromptText' => sanitize_text_field((string) $config['opt_in_prompt_text']),
                'optInPromptTextColor' => sanitize_text_field((string) $config['opt_in_prompt_text_color']),
                'optInPromptIconUrl' => esc_url_raw((string) $config['opt_in_prompt_icon_url']),
                'optInPromptCancelButtonLabel' => sanitize_text_field((string) $config['opt_in_prompt_cancel_button_label']),
                'optInPromptCancelButtonTextColor' => sanitize_text_field((string) $config['opt_in_prompt_cancel_button_text_color']),
                'optInPromptCancelButtonBackgroundColor' => sanitize_text_field((string) $config['opt_in_prompt_cancel_button_background_color']),
                'optInPromptApproveButtonLabel' => sanitize_text_field((string) $config['opt_in_prompt_approve_button_label']),
                'optInPromptApproveButtonTextColor' => sanitize_text_field((string) $config['opt_in_prompt_approve_button_text_color']),
                'optInPromptApproveButtonBackgroundColor' => sanitize_text_field((string) $config['opt_in_prompt_approve_button_background_color']),
                'optInPromptRepromptDelayDays' => (int) $config['opt_in_prompt_reprompt_delay_days'],
                'optInPromptRecentNotificationsLimit' => (int) $config['opt_in_prompt_recent_notifications_limit'],
            ]) . ';',
            'before'
        );
    }

    // Hosts running a strict Content-Security-Policy without 'unsafe-inline' can
    // supply their per-request nonce via this filter so our inline config script
    // (and the SDK <script> tag that loads alongside it) are allowed to execute.
    private static function get_csp_nonce(): string {
        $nonce = apply_filters('epe_push_engine_csp_nonce', '');
        return is_string($nonce) ? $nonce : '';
    }

    public static function add_inline_script_nonce(array $attributes, string $data): array {
        if (!str_contains($data, 'ExoticPushEngineConfig')) {
            return $attributes;
        }

        $nonce = self::get_csp_nonce();
        if ($nonce !== '') {
            $attributes['nonce'] = $nonce;
        }

        // Cloudflare Rocket Loader rewrites the type attribute on every <script>
        // tag it processes (e.g. type="<hash>-text/javascript"), which stops the
        // browser from executing it until the user interacts with the page. The
        // opt-in prompt needs this config available immediately, so opt out via
        // Rocket Loader's documented data-cfasync="false" exclusion attribute.
        $attributes['data-cfasync'] = 'false';

        return $attributes;
    }

    public static function add_script_tag_nonce(string $tag, string $handle): string {
        if ($handle !== 'exotic-push-engine-sdk') {
            return $tag;
        }

        if (!str_contains($tag, 'data-cfasync=')) {
            $tag = str_replace(' src=', ' data-cfasync="false" src=', $tag);
        }

        $nonce = self::get_csp_nonce();
        if ($nonce === '' || str_contains($tag, 'nonce=')) {
            return $tag;
        }

        return str_replace(' src=', ' nonce="' . esc_attr($nonce) . '" src=', $tag);
    }

    public static function inject_manifest_link(): void {
        echo '<link rel="manifest" href="' . esc_url(home_url('/manifest.json')) . '">' . "\n";
    }

    private static function serve_service_worker(): void {
        $config = self::get_site_config();
        status_header(200);
        nocache_headers();
        header('Content-Type: application/javascript; charset=utf-8');
        header('Service-Worker-Allowed: /');

        $icon_url = wp_json_encode(esc_url_raw((string) $config['icon_url']));
        $app_name = wp_json_encode(sanitize_text_field((string) $config['app_name']));

        echo <<<JS
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function acknowledgeDelivery(payload) {
  if (!payload.deliveryId || !payload.ackUrl) {
    return Promise.resolve();
  }

  return fetch(payload.ackUrl, { method: 'POST' }).catch(() => undefined);
}

function acknowledgeClick(clickUrl) {
  if (!clickUrl) {
    return Promise.resolve();
  }

  return fetch(clickUrl, { method: 'POST' }).catch(() => undefined);
}

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || {$app_name};
  const options = {
    body: payload.body || '',
    icon: payload.icon || {$icon_url},
    image: payload.image || undefined,
    data: {
      url: payload.url || '/',
      clickUrl: payload.clickUrl || null,
    },
    actions: Array.isArray(payload.buttons)
      ? payload.buttons.slice(0, 2).map((button) => ({ action: button.url, title: button.label }))
      : [],
  };

  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    acknowledgeDelivery(payload),
  ]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  const clickUrl = event.notification.data && event.notification.data.clickUrl ? event.notification.data.clickUrl : null;
  event.waitUntil(
    Promise.all([
      acknowledgeClick(clickUrl),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) {
              client.navigate(targetUrl);
            }
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      }),
    ])
  );
});
JS;
        exit;
    }

    private static function serve_manifest(): void {
        $config = self::get_site_config();
        status_header(200);
        nocache_headers();
        header('Content-Type: application/manifest+json; charset=utf-8');

        $manifest = [
            'name' => sanitize_text_field((string) $config['app_name']),
            'short_name' => sanitize_text_field((string) $config['app_name']),
            'start_url' => home_url('/'),
            'scope' => home_url('/'),
            'display' => 'standalone',
            'theme_color' => sanitize_hex_color((string) $config['theme_color']) ?: '#1c1917',
            'background_color' => '#fafaf9',
            'icons' => array_values(array_filter([
                $config['icon_url'] ? [
                    'src' => esc_url_raw((string) $config['icon_url']),
                    'sizes' => '192x192',
                    'type' => 'image/png',
                ] : null,
            ])),
        ];

        echo wp_json_encode($manifest, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        exit;
    }

    public static function register_admin_menu(): void {
        add_options_page(
            'Exotic Push Engine',
            'Exotic Push Engine',
            'manage_options',
            'epe-push-engine',
            [__CLASS__, 'render_settings_page']
        );
    }

    public static function register_settings(): void {
        register_setting('epe_push_engine_group', self::OPTION_KEY, [
            'type' => 'array',
            'sanitize_callback' => [__CLASS__, 'sanitize_settings'],
            'default' => [],
        ]);

        add_settings_section(
            'epe_push_engine_main',
            'Site Integration',
            static function (): void {
                echo '<p>Configure the API endpoint and site key. Branding is managed in the EPE site settings and synced automatically.</p>';
            },
            'epe-push-engine'
        );

        self::add_setting_field('api_url',          'API URL',          'url',  'Backend API URL for this site (e.g. https://push.example.com).');
        self::add_setting_field('site_key',         'Site Key',         'text', 'Unique site ID from the EPE dashboard.');
    }

    private static function add_setting_field(string $key, string $label, string $type, string $help): void {
        add_settings_field(
            $key,
            esc_html($label),
            static function () use ($key, $type, $help): void {
                $settings = Exotic_Push_Engine_Plugin::get_settings();
                $value = isset($settings[$key]) ? (string) $settings[$key] : '';
                printf(
                    '<input class="regular-text" type="%1$s" name="%2$s[%3$s]" value="%4$s" />',
                    esc_attr($type),
                    esc_attr(Exotic_Push_Engine_Plugin::OPTION_KEY),
                    esc_attr($key),
                    esc_attr($value)
                );
                echo '<p class="description">' . esc_html($help) . '</p>';
            },
            'epe-push-engine',
            'epe_push_engine_main'
        );
    }

    public static function sanitize_settings(array $input): array {
        $old_settings = self::get_settings();

        $sanitized = [
            'api_url'  => isset($input['api_url'])  ? esc_url_raw((string) $input['api_url'])                 : '',
            'site_key' => isset($input['site_key']) ? sanitize_text_field((string) $input['site_key']) : '',
        ];

        // Settings changes should take effect immediately rather than waiting out the
        // 15-minute site config cache, so clear both the old and new cache entries.
        self::clear_site_config_cache((string) $old_settings['api_url'], (string) $old_settings['site_key']);
        self::clear_site_config_cache($sanitized['api_url'], $sanitized['site_key']);

        return $sanitized;
    }

    private static function site_config_cache_key(string $api_url, string $site_key): string {
        return 'epe_push_engine_site_config_' . md5($api_url . '|' . $site_key);
    }

    private static function clear_site_config_cache(string $api_url, string $site_key): void {
        if ($api_url === '' || $site_key === '') {
            return;
        }
        delete_transient(self::site_config_cache_key($api_url, $site_key));
    }

    private static function get_site_config(): array {
        $settings = self::get_settings();
        $defaults = [
            'api_url' => '',
            'site_key' => '',
            'vapid_public_key' => '',
            'app_name' => get_bloginfo('name'),
            'icon_url' => '',
            'theme_color' => '#1c1917',
            'opt_in_prompt_type' => 'lightbox-1',
            'opt_in_prompt_animation' => 'slide-in',
            'opt_in_prompt_background_color' => '#ffffff',
            'opt_in_prompt_headline' => 'Stay in the loop',
            'opt_in_prompt_headline_text_color' => '#111111',
            'opt_in_prompt_text' => 'Get important updates delivered to your browser.',
            'opt_in_prompt_text_color' => '#444444',
            'opt_in_prompt_icon_url' => '',
            'opt_in_prompt_cancel_button_label' => 'Not now',
            'opt_in_prompt_cancel_button_text_color' => '#ffffff',
            'opt_in_prompt_cancel_button_background_color' => '#111111',
            'opt_in_prompt_approve_button_label' => 'Enable',
            'opt_in_prompt_approve_button_text_color' => '#ffffff',
            'opt_in_prompt_approve_button_background_color' => '#ea580c',
            'opt_in_prompt_reprompt_delay_days' => 30,
        ];

        if ($settings['api_url'] === '' || $settings['site_key'] === '') {
            return $defaults;
        }

        $cache_key = self::site_config_cache_key((string) $settings['api_url'], (string) $settings['site_key']);
        $cached = get_transient($cache_key);
        if (is_array($cached)) {
            return array_merge($defaults, $cached);
        }

        $endpoint = rtrim((string) $settings['api_url'], '/') . '/sites/public/' . rawurlencode((string) $settings['site_key']);
        $response = wp_remote_get($endpoint, [
            'timeout' => 5,
            'headers' => [
                'Accept' => 'application/json',
            ],
        ]);

        if (is_wp_error($response)) {
            return $defaults;
        }

        $status = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $decoded = json_decode($body, true);

        if ($status !== 200 || !is_array($decoded) || !isset($decoded['data']) || !is_array($decoded['data'])) {
            return $defaults;
        }

        $data = $decoded['data'];
        $config = [
            'api_url' => (string) $settings['api_url'],
            'site_key' => (string) $settings['site_key'],
            'vapid_public_key' => isset($data['vapidPublicKey']) ? sanitize_text_field((string) $data['vapidPublicKey']) : '',
            'app_name' => isset($data['appName']) ? sanitize_text_field((string) $data['appName']) : get_bloginfo('name'),
            'icon_url' => isset($data['iconUrl']) ? esc_url_raw((string) $data['iconUrl']) : '',
            'theme_color' => isset($data['themeColor']) ? sanitize_hex_color((string) $data['themeColor']) ?: '#1c1917' : '#1c1917',
            'opt_in_prompt_type' => isset($data['optInPromptType']) ? sanitize_text_field((string) $data['optInPromptType']) : 'lightbox-1',
            'opt_in_prompt_animation' => isset($data['optInPromptAnimation']) ? sanitize_text_field((string) $data['optInPromptAnimation']) : 'slide-in',
            'opt_in_prompt_background_color' => isset($data['optInPromptBackgroundColor']) ? sanitize_text_field((string) $data['optInPromptBackgroundColor']) : '#ffffff',
            'opt_in_prompt_headline' => isset($data['optInPromptHeadline']) ? sanitize_text_field((string) $data['optInPromptHeadline']) : 'Stay in the loop',
            'opt_in_prompt_headline_text_color' => isset($data['optInPromptHeadlineTextColor']) ? sanitize_text_field((string) $data['optInPromptHeadlineTextColor']) : '#111111',
            'opt_in_prompt_text' => isset($data['optInPromptText']) ? sanitize_text_field((string) $data['optInPromptText']) : 'Get important updates delivered to your browser.',
            'opt_in_prompt_text_color' => isset($data['optInPromptTextColor']) ? sanitize_text_field((string) $data['optInPromptTextColor']) : '#444444',
            'opt_in_prompt_icon_url' => isset($data['optInPromptIconUrl']) ? esc_url_raw((string) $data['optInPromptIconUrl']) : '',
            'opt_in_prompt_cancel_button_label' => isset($data['optInPromptCancelButtonLabel']) ? sanitize_text_field((string) $data['optInPromptCancelButtonLabel']) : 'Not now',
            'opt_in_prompt_cancel_button_text_color' => isset($data['optInPromptCancelButtonTextColor']) ? sanitize_text_field((string) $data['optInPromptCancelButtonTextColor']) : '#ffffff',
            'opt_in_prompt_cancel_button_background_color' => isset($data['optInPromptCancelButtonBackgroundColor']) ? sanitize_text_field((string) $data['optInPromptCancelButtonBackgroundColor']) : '#111111',
            'opt_in_prompt_approve_button_label' => isset($data['optInPromptApproveButtonLabel']) ? sanitize_text_field((string) $data['optInPromptApproveButtonLabel']) : 'Enable',
            'opt_in_prompt_approve_button_text_color' => isset($data['optInPromptApproveButtonTextColor']) ? sanitize_text_field((string) $data['optInPromptApproveButtonTextColor']) : '#ffffff',
            'opt_in_prompt_approve_button_background_color' => isset($data['optInPromptApproveButtonBackgroundColor']) ? sanitize_text_field((string) $data['optInPromptApproveButtonBackgroundColor']) : '#ea580c',
            'opt_in_prompt_reprompt_delay_days' => isset($data['optInPromptRepromptDelayDays']) ? (int) $data['optInPromptRepromptDelayDays'] : 30,
            'opt_in_prompt_recent_notifications_limit' => isset($data['optInPromptRecentNotificationsLimit']) ? (int) $data['optInPromptRecentNotificationsLimit'] : 3,
        ];

        set_transient($cache_key, $config, 15 * MINUTE_IN_SECONDS);

        return array_merge($defaults, $config);
    }

    public static function render_settings_page(): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have sufficient permissions to access this page.'));
        }

        echo '<div class="wrap">';
        echo '<h1>Exotic Push Engine</h1>';
        echo '<p>Browser push is served from the WordPress origin at <code>/push-sw.js</code> and <code>/manifest.json</code>. Branding is read from the EPE site record.</p>';
        self::render_connection_status();
        echo '<form method="post" action="options.php">';
        settings_fields('epe_push_engine_group');
        do_settings_sections('epe-push-engine');
        submit_button();
        echo '</form>';
        echo '</div>';
    }

    private static function render_connection_status(): void {
        $settings = self::get_settings();
        $api_url = isset($settings['api_url']) ? (string) $settings['api_url'] : '';
        $site_key = isset($settings['site_key']) ? (string) $settings['site_key'] : '';

        if ($api_url === '' || $site_key === '') {
            echo '<div class="notice notice-warning inline"><p>Enter an API URL and Site Key below to connect this site to Exotic Push Engine.</p></div>';
            return;
        }

        $config = self::get_site_config();
        $connected = $config['api_url'] === $api_url && $config['site_key'] === $site_key && $config['app_name'] !== '';

        if ($connected) {
            echo '<div class="notice notice-success inline"><p>Connected — branding and opt-in prompt settings are syncing from the EPE dashboard.</p></div>';
        } else {
            echo '<div class="notice notice-error inline"><p>Unable to reach the EPE API with these credentials. Double-check the API URL and Site Key, then save again.</p></div>';
        }
    }
}

Exotic_Push_Engine_Plugin::boot();
