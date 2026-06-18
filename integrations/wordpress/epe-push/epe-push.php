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
            'vapid_public_key' => '',
            'icon_url'        => '',
            'app_name'        => get_bloginfo('name'),
            'theme_color'     => '#1c1917',
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
        $settings = self::get_settings();
        $script_url = plugins_url('assets/epe-sdk.js', __FILE__);

        wp_register_script('exotic-push-engine-sdk', $script_url, [], '0.1.0', true);
        wp_enqueue_script('exotic-push-engine-sdk');

        wp_add_inline_script(
            'exotic-push-engine-sdk',
            'window.ExoticPushEngineConfig = ' . wp_json_encode([
                'apiUrl'           => esc_url_raw((string) $settings['api_url']),
                'siteKey'          => sanitize_text_field((string) $settings['site_key']),
                'vapidPublicKey'   => sanitize_text_field((string) $settings['vapid_public_key']),
                'serviceWorkerUrl' => home_url('/push-sw.js'),
                'manifestUrl'      => home_url('/manifest.json'),
                'iconUrl'          => esc_url_raw((string) $settings['icon_url']),
                'appName'          => sanitize_text_field((string) $settings['app_name']),
            ]) . ';',
            'before'
        );
    }

    public static function inject_manifest_link(): void {
        echo '<link rel="manifest" href="' . esc_url(home_url('/manifest.json')) . '">' . "\n";
    }

    private static function serve_service_worker(): void {
        $settings = self::get_settings();
        status_header(200);
        nocache_headers();
        header('Content-Type: application/javascript; charset=utf-8');
        header('Service-Worker-Allowed: /');

        $icon_url = wp_json_encode(esc_url_raw((string) $settings['icon_url']));
        $app_name = wp_json_encode(sanitize_text_field((string) $settings['app_name']));

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
        $settings = self::get_settings();
        status_header(200);
        nocache_headers();
        header('Content-Type: application/manifest+json; charset=utf-8');

        $manifest = [
            'name' => sanitize_text_field((string) $settings['app_name']),
            'short_name' => sanitize_text_field((string) $settings['app_name']),
            'start_url' => home_url('/'),
            'scope' => home_url('/'),
            'display' => 'standalone',
            'theme_color' => sanitize_hex_color((string) $settings['theme_color']) ?: '#1c1917',
            'background_color' => '#fafaf9',
            'icons' => array_values(array_filter([
                $settings['icon_url'] ? [
                    'src' => esc_url_raw((string) $settings['icon_url']),
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
                echo '<p>Configure the site-specific push integration details.</p>';
            },
            'epe-push-engine'
        );

        self::add_setting_field('api_url',          'API URL',          'url',  'Backend API URL for this site (e.g. https://push.example.com).');
        self::add_setting_field('site_key',         'Site Key',         'text', 'Unique site ID from the EPE dashboard.');
        self::add_setting_field('vapid_public_key', 'VAPID Public Key', 'text', 'Base64url VAPID public key — copy from EPE dashboard → site → Generate VAPID Keys.');
        self::add_setting_field('icon_url',         'Icon URL',         'url',  'Icon used in the service worker and manifest (192×192 PNG recommended).');
        self::add_setting_field('app_name',         'App Name',         'text', 'Display name shown in the push permission prompt.');
        self::add_setting_field('theme_color',      'Theme Color',      'text', 'Manifest theme color in hex format (e.g. #1c1917).');
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
        return [
            'api_url'          => isset($input['api_url'])          ? esc_url_raw((string) $input['api_url'])                                           : '',
            'site_key'         => isset($input['site_key'])         ? sanitize_text_field((string) $input['site_key'])                                   : '',
            'vapid_public_key' => isset($input['vapid_public_key']) ? sanitize_text_field((string) $input['vapid_public_key'])                           : '',
            'icon_url'         => isset($input['icon_url'])         ? esc_url_raw((string) $input['icon_url'])                                           : '',
            'app_name'         => isset($input['app_name'])         ? sanitize_text_field((string) $input['app_name'])                                   : get_bloginfo('name'),
            'theme_color'      => isset($input['theme_color'])      ? sanitize_hex_color((string) $input['theme_color']) ?: '#1c1917'                    : '#1c1917',
        ];
    }

    public static function render_settings_page(): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have sufficient permissions to access this page.'));
        }

        echo '<div class="wrap">';
        echo '<h1>Exotic Push Engine</h1>';
        echo '<p>Browser push is served from the WordPress origin at <code>/push-sw.js</code> and <code>/manifest.json</code>.</p>';
        echo '<form method="post" action="options.php">';
        settings_fields('epe_push_engine_group');
        do_settings_sections('epe-push-engine');
        submit_button();
        echo '</form>';
        echo '</div>';
    }
}

Exotic_Push_Engine_Plugin::boot();
