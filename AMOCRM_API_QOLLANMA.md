# amoCRM API Qo'llanmasi (O'zbek tilida)

Bu qo'llanma amoCRM API bilan ishlash uchun to'liq yo'riqnoma hisoblanadi. Unda autentifikatsiya (OAuth 2.0) va Sdelkalar (Deals/Leads) API'lari haqida batafsil ma'lumot berilgan.

---

## Mundarija

1. [Kirish](#kirish)
2. [OAuth 2.0 Autentifikatsiya](#oauth-20-autentifikatsiya)
   - [OAuth nima?](#oauth-nima)
   - [Asosiy tushunchalar](#asosiy-tushunchalar)
   - [Integratsiya yaratish](#integratsiya-yaratish)
   - [Access Token olish](#access-token-olish)
   - [Token yangilash](#token-yangilash)
   - [PHP kod misollari](#php-kod-misollari)
3. [Sdelkalar (Leads) API](#sdelkalar-leads-api)
   - [Sdelkalar ro'yxatini olish](#sdelkalar-royxatini-olish)
   - [Bitta sdelkani ID bo'yicha olish](#bitta-sdelkani-id-boyicha-olish)
   - [Yangi sdelka qo'shish](#yangi-sdelka-qoshish)
   - [Sdelkani tahrirlash](#sdelkani-tahrirlash)
   - [Murakkab sdelka qo'shish](#murakkab-sdelka-qoshish)
4. [Marketplace va SaaS Integratsiyasi (Ko'p foydalanuvchili tizimlar)](#marketplace-va-saas-integratsiyasi-kop-foydalanuvchili-tizimlar)
   - [Public Integration tushunchasi](#public-integration-tushunchasi)
   - [Arxitektura (Database sxemasi)](#arxitektura-database-sxemasi)
   - [Tokenlarni boshqarish](#tokenlarni-boshqarish)
5. [Voronkalar va Statuslar (Pipelines)](#voronkalar-va-statuslar-pipelines)
   - [Voronkalar ro'yxatini olish](#voronkalar-royxatini-olish-1)
   - [Yangi voronka yaratish](#yangi-voronka-yaratish)
   - [Sdelkani ma'lum bir voronkaga qo'shish](#sdelkani-malum-bir-voronkaga-qoshish)
6. [Bozor (Marketplace) uchun zarur bo'lgan boshqa API'lar](#bozor-marketplace-uchun-zarur-bolgan-boshqa-apilar)
   - [Kontaktlar API](#kontaktlar-api-1)
   - [Maxsus maydonlar (Custom Fields) API](#maxsus-maydonlar-custom-fields-api-1)
   - [Webhooklar API](#webhooklar-api-1)
7. [Xatolar va ularni hal qilish](#xatolar-va-ularni-hal-qilish)
8. [Foydali maslahatlar](#foydali-maslahatlar)

---

## Kirish

amoCRM - bu mijozlar bilan munosabatlarni boshqarish (CRM) tizimi. API orqali siz o'z ilovangizni amoCRM bilan integratsiya qilishingiz mumkin.

### API asosiy URL manzili

```
https://[subdomain].amocrm.ru/api/v4/
```

Masalan, agar sizning subdomain'ingiz `mycompany` bo'lsa:
```
https://mycompany.amocrm.ru/api/v4/
```

---

## OAuth 2.0 Autentifikatsiya

### OAuth nima?

OAuth 2.0 - bu ilovangizga foydalanuvchi ma'lumotlariga cheklangan kirish huquqini beradigan avtorizatsiya protokoli.

**OAuth'da asosiy rollar:**
- **Foydalanuvchi (Egasi)** - ilovaga o'z hisobiga kirish huquqini beradi
- **Resurs serveri** - amoCRM serverlari, foydalanuvchi ma'lumotlari saqlanadigan joy
- **Mijoz ilovasi** - sizning ilovangiz yoki servisingiz

### Asosiy tushunchalar

| Tushuncha | Ta'rifi |
|-----------|---------|
| **Integration ID** | Integratsiyangizning noyob identifikatori |
| **Secret Key** | Maxfiy kalit, faqat siz bilishingiz kerak |
| **Authorization Code** | Vaqtinchalik kod (20 daqiqa amal qiladi) |
| **Access Token** | API'ga kirish tokeni (1 kun amal qiladi) |
| **Refresh Token** | Access tokeni yangilash uchun (3 oy amal qiladi) |

### Integratsiya yaratish

1. amoCRM akkauntingizga kiring
2. **amoMarket** bo'limiga o'ting
3. O'ng yuqori burchakdagi uchta nuqtani bosing
4. **"Maxsus integratsiya yaratish"** ni tanlang
5. Kerakli ma'lumotlarni to'ldiring:
   - Integratsiya nomi
   - Redirect URI (callback URL)
   - Kerakli ruxsatlar (permissions)

Yaratilgandan so'ng, siz quyidagilarni olasiz:
- **Integration ID** (client_id)
- **Secret Key** (client_secret)
- **Authorization Code** (bir martalik)

### Access Token olish va yangilash (OAuth Oqimi)

Foydalanuvchi akkauntini ulash jarayoni quyidagicha kechadi:

1.  **Foydalanuvchi qadami:** Sizning saytingizda "amoCRM-ga ulanish" tugmasini bosadi.
2.  **Yo'naltirish (Redirect):** Saytingiz foydalanuvchini amoCRM avtorizatsiya sahifasiga yuboradi.
3.  **Ruxsat berish:** amoCRM foydalanuvchiga "Ushbu ilova sizning ma'lumotlaringizga kirishiga ruxsat berasizmi?" degan savol beradi. Foydalanuvchi "Ruxsat berish" tugmasini bosadi.
4.  **Kod qaytishi:** amoCRM foydalanuvchini sizning `redirect_uri` manzilingizga qaytaradi va URL-da maxsus `code` (masalan, `?code=def502...`) yuboradi.
5.  **Tokenga almashtirish:** Sizning serveringiz orqa fonda (foydalanuvchiga ko'rinmasdan) ushbu `code`ni amoCRM serveriga yuboradi va o'rniga `access_token` va `refresh_token` oladi.
6.  **Tayyor:** Endi sizning tizimingizda foydalanuvchining amoCRM-siga ma'lumot yuborish uchun "kalit" bor.

> ⚠️ **Muhim:** Siz foydalanuvchining login yoki parolini olmaysiz. Siz faqat "Token" (kalit) olasiz. Foydalanuvchi xohlagan vaqtda amoCRM sozlamalaridan ushbu ruxsatni bekor qilishi mumkin.

---
#### 1-qadam: Authorization Code olish

Foydalanuvchini quyidagi URL'ga yo'naltiring:

```
https://www.amocrm.ru/oauth?client_id={Integration_ID}&state={state}&mode=post_message
```

#### 2-qadam: Authorization Code'ni tokenga almashtirish

**So'rov (POST):**
```
POST https://{subdomain}.amocrm.ru/oauth2/access_token
Content-Type: application/json
```

**So'rov tanasi:**
```json
{
    "client_id": "INTEGRATION_ID",
    "client_secret": "SECRET_KEY",
    "grant_type": "authorization_code",
    "code": "AUTHORIZATION_CODE",
    "redirect_uri": "https://your-redirect-uri.com/callback"
}
```

**Javob:**
```json
{
    "token_type": "Bearer",
    "expires_in": 86400,
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGci...",
    "refresh_token": "def50200a3add8f2fc1..."
}
```

### Token yangilash

Access token muddati tugaganda (1 kundan so'ng), refresh token yordamida yangilab olishingiz mumkin:

**So'rov (POST):**
```
POST https://{subdomain}.amocrm.ru/oauth2/access_token
Content-Type: application/json
```

**So'rov tanasi:**
```json
{
    "client_id": "INTEGRATION_ID",
    "client_secret": "SECRET_KEY",
    "grant_type": "refresh_token",
    "refresh_token": "REFRESH_TOKEN",
    "redirect_uri": "https://your-redirect-uri.com/callback"
}
```

> ⚠️ **Muhim:** Har safar token yangilanganda, yangi access token VA yangi refresh token beriladi. Eski tokenlar ishlamay qoladi.

### PHP kod misollari

#### Token olish

```php
<?php

function getAccessToken($subdomain, $clientId, $clientSecret, $code, $redirectUri)
{
    $url = "https://{$subdomain}.amocrm.ru/oauth2/access_token";
    
    $data = [
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'grant_type' => 'authorization_code',
        'code' => $code,
        'redirect_uri' => $redirectUri
    ];
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        return json_decode($response, true);
    }
    
    throw new Exception("Token olishda xato: " . $response);
}

// Foydalanish
$tokens = getAccessToken(
    'mycompany',
    'INTEGRATION_ID',
    'SECRET_KEY',
    'AUTHORIZATION_CODE',
    'https://your-site.com/callback'
);

echo "Access Token: " . $tokens['access_token'];
echo "Refresh Token: " . $tokens['refresh_token'];
```

#### Token yangilash

```php
<?php

function refreshAccessToken($subdomain, $clientId, $clientSecret, $refreshToken, $redirectUri)
{
    $url = "https://{$subdomain}.amocrm.ru/oauth2/access_token";
    
    $data = [
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'grant_type' => 'refresh_token',
        'refresh_token' => $refreshToken,
        'redirect_uri' => $redirectUri
    ];
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        return json_decode($response, true);
    }
    
    throw new Exception("Token yangilashda xato: " . $response);
}
```

---

## Sdelkalar (Leads) API

Sdelka (Lead) - bu amoCRM'dagi asosiy ob'ekt bo'lib, potentsial sotuvni ifodalaydi.

### API so'rovlari uchun umumiy funksiya

```php
<?php

function makeApiRequest($subdomain, $accessToken, $method, $endpoint, $data = null)
{
    $url = "https://{$subdomain}.amocrm.ru/api/v4/{$endpoint}";
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);
    
    switch (strtoupper($method)) {
        case 'POST':
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            break;
        case 'PATCH':
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            break;
        case 'DELETE':
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
            break;
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return [
        'code' => $httpCode,
        'data' => json_decode($response, true)
    ];
}
```

### Sdelkalar ro'yxatini olish

**Metod:** `GET /api/v4/leads`

**Mavjud parametrlar:**

| Parametr | Turi | Ta'rifi |
|----------|------|---------|
| `page` | int | Sahifa raqami (1 dan boshlab) |
| `limit` | int | Har sahifada natijalar soni (max: 250) |
| `with` | string | Qo'shimcha ma'lumotlar (`contacts`, `catalog_elements`, `loss_reason`) |
| `filter[id]` | int/array | ID bo'yicha filtrlash |
| `filter[status_id]` | int/array | Status bo'yicha filtrlash |
| `filter[pipeline_id]` | int/array | Voronka (pipeline) bo'yicha filtrlash |

**PHP misoli:**

```php
<?php

// Barcha sdelkalarni olish
function getLeads($subdomain, $accessToken, $page = 1, $limit = 50)
{
    $endpoint = "leads?page={$page}&limit={$limit}";
    return makeApiRequest($subdomain, $accessToken, 'GET', $endpoint);
}

// Kontaktlar bilan birga olish
function getLeadsWithContacts($subdomain, $accessToken)
{
    $endpoint = "leads?with=contacts";
    return makeApiRequest($subdomain, $accessToken, 'GET', $endpoint);
}

// Foydalanish
$response = getLeads('mycompany', $accessToken, 1, 50);

if ($response['code'] === 200) {
    $leads = $response['data']['_embedded']['leads'];
    
    foreach ($leads as $lead) {
        echo "Sdelka ID: " . $lead['id'] . "\n";
        echo "Nomi: " . $lead['name'] . "\n";
        echo "Narxi: " . $lead['price'] . "\n";
        echo "---\n";
    }
}
```

**Javob namunasi:**

```json
{
    "_page": 1,
    "_links": {
        "self": {
            "href": "https://example.amocrm.ru/api/v4/leads?page=1&limit=50"
        }
    },
    "_embedded": {
        "leads": [
            {
                "id": 19619,
                "name": "Yangi mijoz sdelkasi",
                "price": 50000,
                "responsible_user_id": 123321,
                "group_id": 625,
                "status_id": 142,
                "pipeline_id": 1300,
                "loss_reason_id": null,
                "created_by": 321123,
                "updated_by": 321123,
                "created_at": 1453279607,
                "updated_at": 1502193501,
                "closed_at": null,
                "is_deleted": false,
                "account_id": 5135160,
                "_embedded": {
                    "tags": [],
                    "companies": []
                }
            }
        ]
    }
}
```

### Bitta sdelkani ID bo'yicha olish

**Metod:** `GET /api/v4/leads/{id}`

**PHP misoli:**

```php
<?php

function getLeadById($subdomain, $accessToken, $leadId)
{
    $endpoint = "leads/{$leadId}";
    return makeApiRequest($subdomain, $accessToken, 'GET', $endpoint);
}

// Kontaktlar va kompaniyalar bilan birga olish
function getLeadWithDetails($subdomain, $accessToken, $leadId)
{
    $endpoint = "leads/{$leadId}?with=contacts,companies,catalog_elements,loss_reason";
    return makeApiRequest($subdomain, $accessToken, 'GET', $endpoint);
}

// Foydalanish
$response = getLeadById('mycompany', $accessToken, 19619);

if ($response['code'] === 200) {
    $lead = $response['data'];
    echo "Sdelka nomi: " . $lead['name'] . "\n";
    echo "Byudjet: " . $lead['price'] . " so'm\n";
}
```

### Yangi sdelka qo'shish

**Metod:** `POST /api/v4/leads`

**Asosiy parametrlar:**

| Parametr | Turi | Ta'rifi |
|----------|------|---------|
| `name` | string | Sdelka nomi |
| `price` | int | Byudjet (narx) |
| `status_id` | int | Status ID |
| `pipeline_id` | int | Voronka (pipeline) ID |
| `responsible_user_id` | int | Mas'ul shaxs ID |
| `custom_fields_values` | array | Maxsus maydonlar qiymatlari |

**PHP misoli:**

```php
<?php

function createLead($subdomain, $accessToken, $leadData)
{
    return makeApiRequest($subdomain, $accessToken, 'POST', 'leads', [$leadData]);
}

// Foydalanish
$newLead = [
    'name' => 'Yangi sdelka',
    'price' => 100000,
    'status_id' => 142,          // Status ID
    'pipeline_id' => 1300,       // Voronka ID
    'responsible_user_id' => 123 // Mas'ul shaxs ID
];

$response = createLead('mycompany', $accessToken, $newLead);

if ($response['code'] === 200) {
    $createdLead = $response['data']['_embedded']['leads'][0];
    echo "Sdelka yaratildi. ID: " . $createdLead['id'];
}
```

**Maxsus maydonlar bilan:**

```php
<?php

$newLeadWithCustomFields = [
    'name' => 'Premium sdelka',
    'price' => 500000,
    'custom_fields_values' => [
        [
            'field_id' => 294471,  // Maxsus maydon ID
            'values' => [
                ['value' => 'Maxsus maydon qiymati']
            ]
        ]
    ],
    'tags_to_add' => [
        ['name' => 'VIP'],
        ['name' => 'Premium']
    ]
];

$response = createLead('mycompany', $accessToken, $newLeadWithCustomFields);
```

### Sdelkani tahrirlash

**Metod:** `PATCH /api/v4/leads` (ko'plab) yoki `PATCH /api/v4/leads/{id}` (bitta)

**PHP misoli:**

```php
<?php

// Bitta sdelkani tahrirlash
function updateLead($subdomain, $accessToken, $leadId, $updateData)
{
    $endpoint = "leads/{$leadId}";
    return makeApiRequest($subdomain, $accessToken, 'PATCH', $endpoint, $updateData);
}

// Ko'plab sdelkalarni tahrirlash
function updateLeads($subdomain, $accessToken, $leadsData)
{
    return makeApiRequest($subdomain, $accessToken, 'PATCH', 'leads', $leadsData);
}

// Bitta sdelkani tahrirlash
$updateData = [
    'name' => 'Yangilangan nom',
    'price' => 200000
];

$response = updateLead('mycompany', $accessToken, 19619, $updateData);

// Ko'plab sdelkalarni tahrirlash
$multipleUpdates = [
    [
        'id' => 19619,
        'price' => 150000
    ],
    [
        'id' => 19620,
        'status_id' => 143  // Statusni o'zgartirish
    ]
];

$response = updateLeads('mycompany', $accessToken, $multipleUpdates);
```

**Teglarni boshqarish:**

```php
<?php

// Teglarni qo'shish va o'chirish
$updateWithTags = [
    'id' => 19619,
    'tags_to_add' => [
        ['name' => 'Yangi teg']
    ],
    'tags_to_delete' => [
        ['name' => 'Eski teg']
    ]
];

$response = updateLeads('mycompany', $accessToken, [$updateWithTags]);
```

### Murakkab sdelka qo'shish

**Metod:** `POST /api/v4/leads/complex`

Bu metod sdelka bilan birga kontakt va kompaniya qo'shish imkonini beradi.

**PHP misoli:**

```php
<?php

function createComplexLead($subdomain, $accessToken, $leadData)
{
    return makeApiRequest($subdomain, $accessToken, 'POST', 'leads/complex', [$leadData]);
}

$complexLead = [
    'name' => 'Murakkab sdelka',
    'price' => 300000,
    'status_id' => 142,
    'pipeline_id' => 1300,
    'responsible_user_id' => 123,
    '_embedded' => [
        'contacts' => [
            [
                'first_name' => 'Alisher',
                'last_name' => 'Navoiy',
                'custom_fields_values' => [
                    [
                        'field_code' => 'PHONE',
                        'values' => [
                            [
                                'enum_code' => 'WORK',
                                'value' => '+998901234567'
                            ]
                        ]
                    ],
                    [
                        'field_code' => 'EMAIL',
                        'values' => [
                            [
                                'enum_code' => 'WORK',
                                'value' => 'alisher@example.com'
                            ]
                        ]
                    ]
                ]
            ]
        ],
        'companies' => [
            [
                'name' => 'Example LLC'
            ]
        ]
    ]
];

$response = createComplexLead('mycompany', $accessToken, $complexLead);

if ($response['code'] === 200) {
    $result = $response['data'][0];
    echo "Sdelka ID: " . $result['id'] . "\n";
    echo "Kontakt ID: " . $result['contact_id'] . "\n";
    echo "Kompaniya ID: " . $result['company_id'] . "\n";
}
```

---

## Xatolar va ularni hal qilish

### HTTP status kodlari

| Kod | Ma'nosi | Tavsif |
|-----|---------|--------|
| 200 | OK | So'rov muvaffaqiyatli bajarildi |
| 201 | Created | Resurs muvaffaqiyatli yaratildi |
| 204 | No Content | Kontent yo'q (o'chirish so'rovlari uchun) |
| 400 | Bad Request | Noto'g'ri so'rov formati |
| 401 | Unauthorized | Avtorizatsiya xatosi (token muddati tugagan) |
| 403 | Forbidden | Ruxsat yo'q |
| 404 | Not Found | Resurs topilmadi |
| 429 | Too Many Requests | So'rovlar chegarasidan oshib ketdi |
| 500 | Server Error | Server xatosi |

### Xatolar bilan ishlash

```php
<?php

function handleApiError($response)
{
    $code = $response['code'];
    $data = $response['data'];
    
    switch ($code) {
        case 401:
            // Token muddati tugagan - yangilash kerak
            echo "Token muddati tugadi. Yangilang.\n";
            break;
            
        case 429:
            // So'rovlar chegarasi - kuting
            echo "Juda ko'p so'rov. 1 soniya kuting.\n";
            sleep(1);
            break;
            
        case 400:
            // Noto'g'ri so'rov
            echo "Xato: " . json_encode($data) . "\n";
            break;
            
        case 403:
            // Ruxsat yo'q
            echo "Bu amalni bajarishga ruxsat yo'q.\n";
            break;
            
        default:
            echo "Xatolik: HTTP {$code}\n";
    }
}
```

### So'rovlar chegarasi

amoCRM API'da so'rovlar chegarasi mavjud:
- **Soniyiga:** 7 so'rov
- **Daqiqasiga:** 100 so'rov

```php
<?php

class RateLimiter
{
    private $lastRequestTime = 0;
    private $minInterval = 150; // millisekundlar (7 so'rov/soniya uchun)
    
    public function wait()
    {
        $now = microtime(true) * 1000;
        $elapsed = $now - $this->lastRequestTime;
        
        if ($elapsed < $this->minInterval) {
            usleep(($this->minInterval - $elapsed) * 1000);
        }
        
        $this->lastRequestTime = microtime(true) * 1000;
    }
}

// Foydalanish
$limiter = new RateLimiter();

for ($i = 0; $i < 100; $i++) {
    $limiter->wait();
    $response = getLeads('mycompany', $accessToken, $i + 1);
    // ...
}
```

---

## Foydali maslahatlar

### 1. Tokenlarni saqlash

```php
<?php

class TokenStorage
{
    private $storageFile = 'tokens.json';
    
    public function save($accessToken, $refreshToken, $expiresIn)
    {
        $data = [
            'access_token' => $accessToken,
            'refresh_token' => $refreshToken,
            'expires_at' => time() + $expiresIn
        ];
        
        file_put_contents($this->storageFile, json_encode($data));
    }
    
    public function load()
    {
        if (!file_exists($this->storageFile)) {
            return null;
        }
        
        return json_decode(file_get_contents($this->storageFile), true);
    }
    
    public function isExpired()
    {
        $tokens = $this->load();
        
        if (!$tokens) {
            return true;
        }
        
        // 5 daqiqa muddatidan oldin yangilash
        return time() >= ($tokens['expires_at'] - 300);
    }
}
```

### 2. To'liq klass misoli

```php
<?php

class AmoCRMClient
{
    private $subdomain;
    private $clientId;
    private $clientSecret;
    private $redirectUri;
    private $tokenStorage;
    private $rateLimiter;
    
    public function __construct($subdomain, $clientId, $clientSecret, $redirectUri)
    {
        $this->subdomain = $subdomain;
        $this->clientId = $clientId;
        $this->clientSecret = $clientSecret;
        $this->redirectUri = $redirectUri;
        $this->tokenStorage = new TokenStorage();
        $this->rateLimiter = new RateLimiter();
    }
    
    public function getAuthUrl($state = '')
    {
        return "https://www.amocrm.ru/oauth?" . http_build_query([
            'client_id' => $this->clientId,
            'state' => $state,
            'mode' => 'post_message'
        ]);
    }
    
    public function authorize($code)
    {
        $tokens = $this->getTokens($code, 'authorization_code');
        $this->tokenStorage->save(
            $tokens['access_token'],
            $tokens['refresh_token'],
            $tokens['expires_in']
        );
        
        return true;
    }
    
    private function getAccessToken()
    {
        if ($this->tokenStorage->isExpired()) {
            $tokens = $this->tokenStorage->load();
            $newTokens = $this->getTokens($tokens['refresh_token'], 'refresh_token');
            $this->tokenStorage->save(
                $newTokens['access_token'],
                $newTokens['refresh_token'],
                $newTokens['expires_in']
            );
        }
        
        return $this->tokenStorage->load()['access_token'];
    }
    
    private function getTokens($credential, $grantType)
    {
        $url = "https://{$this->subdomain}.amocrm.ru/oauth2/access_token";
        
        $data = [
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret,
            'grant_type' => $grantType,
            'redirect_uri' => $this->redirectUri
        ];
        
        if ($grantType === 'authorization_code') {
            $data['code'] = $credential;
        } else {
            $data['refresh_token'] = $credential;
        }
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        return json_decode($response, true);
    }
    
    private function request($method, $endpoint, $data = null)
    {
        $this->rateLimiter->wait();
        
        $url = "https://{$this->subdomain}.amocrm.ru/api/v4/{$endpoint}";
        $accessToken = $this->getAccessToken();
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json'
        ]);
        
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif ($method === 'PATCH') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        return [
            'code' => $httpCode,
            'data' => json_decode($response, true)
        ];
    }
    
    // Sdelkalar metodlari
    
    public function getLeads($page = 1, $limit = 50, $with = null)
    {
        $params = ['page' => $page, 'limit' => $limit];
        if ($with) {
            $params['with'] = $with;
        }
        
        return $this->request('GET', 'leads?' . http_build_query($params));
    }
    
    public function getLead($id, $with = null)
    {
        $endpoint = "leads/{$id}";
        if ($with) {
            $endpoint .= '?with=' . $with;
        }
        
        return $this->request('GET', $endpoint);
    }
    
    public function createLead($leadData)
    {
        return $this->request('POST', 'leads', [$leadData]);
    }
    
    public function updateLead($id, $updateData)
    {
        return $this->request('PATCH', "leads/{$id}", $updateData);
    }
    
    public function createComplexLead($leadData)
    {
        return $this->request('POST', 'leads/complex', [$leadData]);
    }
    
    // Voronkalar metodlari
    
    public function getPipelines()
    {
        return $this->request('GET', 'leads/pipelines');
    }
    
    public function createPipeline($pipelineData)
    {
        return $this->request('POST', 'leads/pipelines', [$pipelineData]);
    }
}

// Foydalanish
$amocrm = new AmoCRMClient(
    'mycompany',
    'CLIENT_ID',
    'CLIENT_SECRET',
    'https://mysite.com/callback'
);

// Sdelkalarni olish
$leads = $amocrm->getLeads(1, 50, 'contacts');

// Yangi sdelka yaratish
$newLead = $amocrm->createLead([
    'name' => 'Test sdelka',
    'price' => 100000
]);

// Sdelkani yangilash
$amocrm->updateLead(123456, [
    'price' => 150000
]);
```

---

## Marketplace va SaaS Integratsiyasi (Ko'p foydalanuvchili tizimlar)

Agar siz Marketplace platformasi qurayotgan bo'lsangiz va sellerlar (sotuvchilar) o'z amoCRM akkauntlarini sizning tizimingizga ulashlarini xohlasangiz, quyidagi arxitekturadan foydalanasiz.

### Public Integration tushunchasi

Siz bitta **"Publichnaya integratsiya"** yaratasiz. Bu integratsiya sizning platformangiz uchun "kirish eshigi" bo'ladi. Har bir seller o'z akkauntida aynan shu integratsiyani faollashtiradi.

### Arxitektura (Database sxemasi)

Har bir foydalanuvchi ma'lumotlarini alohida saqlash uchun ma'lumotlar bazasida `amocrm_connections` jadvalini yaratish tavsiya etiladi:

| Ustun | Turi | Tavsif |
|-------|------|--------|
| `user_id` | integer | Platformangizdagi seller ID-si |
| `subdomain` | string | Sellerning amoCRM subdomeni (masalan: `savdo123`) |
| `access_token`| text | API-ga kirish kaliti |
| `refresh_token`| text | Tokenni yangilash kaliti |
| `expires_at` | timestamp| Access token muddati tugash vaqti |

### Tokenlarni boshqarish

1. **Ulash jarayoni**: Seller sizning saytingizda "Connect amoCRM" tugmasini bosadi -> amoCRM ruxsat so'raydi -> Sizga `code` qaytadi -> Siz uni `access_token` va `refresh_token`ga almashtirib, bazaga saqlaysiz.
2. **So'rov yuborish**: Har bir foydalanuvchi uchun API so'rovi yuborayotganda, bazadan aynan shu foydalanuvchining `subdomain` va `access_token`ini olib ishlatasiz.
3. **Avtomatik yangilash**: Cron job (fon ishi) orqali har soatda bazani tekshirib, `expires_at` muddati kam qolgan tokenlarni `refresh_token` yordamida yangilab turasiz.
   
   > 💡 **Tavsiya (Tashqi Cron Job):** Agar serveringizga ortiqcha yuk tushishini xohlamasangiz yoki ishonchlilikni oshirmoqchi bo'lsangiz, tashqi Cron Job servislari (masalan, [Cron-job.org](https://cron-job.org/)) orqali ma'lum bir URL'ga so'rov yuborishni sozlashingiz mumkin.
   > 
   > **Xavfsizlik:** Tashqi servis murojaat qiladigan URL'ni xavfsiz qilish uchun unga maxfiy kalit qo'shing:
   > `https://your-site.com/api/amocrm/refresh?secret_key=YOUR_UNIQUE_KEY`

---

## Voronkalar va Statuslar (Pipelines)

Voronkalar (Pipelines) amoCRM'da sdelkalarni bosqichma-bosqich boshqarish uchun xizmat qiladi. Marketplace holatida, siz har bir seller uchun o'z maxsus voronkangizni yaratishingiz mumkin.

### Voronkalar ro'yxatini olish

**Metod:** `GET /api/v4/leads/pipelines`

Ushbu metod akkauntdagi barcha voronkalarni va ularning ichidagi statuslarni ko'rish imkonini beradi.

### Yangi voronka yaratish

**Metod:** `POST /api/v4/leads/pipelines`

Varonka yaratishda siz statuslarni ham bir vaqtda belgilashingiz mumkin.

**PHP misoli:**

```php
$newPipeline = [
    'name' => 'Marketplace Sotuvlari',
    'sort' => 10,
    '_embedded' => [
        'statuses' => [
            ['name' => 'Yangi buyurtma', 'sort' => 10, 'color' => '#99ccff'],
            ['name' => 'To\'lov kutilmoqda', 'sort' => 20, 'color' => '#ffff99'],
            ['name' => 'Yetkazib berishda', 'sort' => 30, 'color' => '#ffcc66'],
            ['id' => 142, 'name' => 'Sotuv yakunlandi'], // Tizim statusini nomlash
            ['id' => 143, 'name' => 'Bekor qilindi']     // Tizim statusini nomlash
        ]
    ]
];

$response = $amocrm->request('POST', 'leads/pipelines', [$newPipeline]);
```

### Sdelkani ma'lum bir voronkaga qo'shish

Sdelka yaratayotganda yoki uni tahrirlayotganda `pipeline_id` va `status_id` parametrlarini ko'rsatish orqali uni kerakli joyga joylashtirishingiz mumkin.

**PHP misoli:**

```php
$leadData = [
    'name' => 'Yangi buyurtma #1234',
    'price' => 250000,
    'pipeline_id' => 3177727, // Voronka ID
    'status_id' => 32392159   // Status ID
];

$response = $amocrm->createLead($leadData);
```

> 💡 **Maslahat:** Har doim yangi voronka yaratgandan so'ng, uning `id`sini va statuslarining `id`larini bazangizda saqlab qoling. Shunda keyingi safar sdelka qo'shishda ulardan foydalanishingiz oson bo'ladi.

---

## Bozor (Marketplace) uchun zarur bo'lgan boshqa API'lar

Sdelka va Voronkalardan tashqari, to'liq integratsiya uchun quyidagi API'lar ham juda muhim:

### Kontaktlar API

Sdelkani shunchaki yaratish kifoya emas, uni mijoz (kontakt) bilan bog'lash kerak.
- **Nima uchun kerak?** Mijozning ismi, telefon raqami va emailini saqlash uchun.
- **Metod:** `POST /api/v4/contacts`

### Maxsus maydonlar (Custom Fields) API

Sizning platformangizga xos ma'lumotlarni amoCRM'da saqlash uchun.
- **Nima uchun kerak?** Masalan, buyurtma raqami, mahsulot ssilkasi yoki seller reytingini sdelkaning o'zida ko'rsatib turish uchun.
- **Metod:** `GET /api/v4/leads/custom_fields` (mavjud maydonlarni ko'rish)

### Webhooklar API

amoCRM'dagi o'zgarishlar haqida sizning saytingizga bildirishnoma yuborish.
- **Nima uchun kerak?** Agar menedjer amoCRM ichida sdelka statusini o'zgartirsa (masalan, "To'landi" qilsa), sizning platformangiz bunga real vaqtda reaksiya qilishi (masalan, sellerga pulni o'tkazishi) uchun.
- **Metod:** `POST /api/v4/webhooks`

---

### 3. Webhook'lar bilan ishlash

amoCRM o'zgarishlarni real vaqtda xabarlash uchun webhook'larni qo'llab-quvvatlaydi:

```php
<?php

// webhook.php - sizning serveringizdagi webhook endpoint

$payload = file_get_contents('php://input');
$data = json_decode($payload, true);

// Sdelka qo'shilganda
if (isset($data['leads']['add'])) {
    foreach ($data['leads']['add'] as $lead) {
        // Yangi sdelka bilan ishlash
        processNewLead($lead['id']);
    }
}

// Sdelka yangilanganda
if (isset($data['leads']['update'])) {
    foreach ($data['leads']['update'] as $lead) {
        // Yangilangan sdelka bilan ishlash
        processUpdatedLead($lead['id']);
    }
}
```

---

## Qo'shimcha resurslar

- **Rasmiy hujjatlar:** [https://www.amocrm.ru/developers/](https://www.amocrm.ru/developers/)
- **PHP kutubxonasi:** [https://github.com/amocrm/amocrm-api-php](https://github.com/amocrm/amocrm-api-php)
- **oAuth hujjatlari:** [https://www.amocrm.ru/developers/content/oauth/oauth](https://www.amocrm.ru/developers/content/oauth/oauth)
- **Sdelkalar API:** [https://www.amocrm.ru/developers/content/crm_platform/leads-api](https://www.amocrm.ru/developers/content/crm_platform/leads-api)

---

*Bu qo'llanma amoCRM API v4 uchun tayyorlangan. Oxirgi yangilanish: 2026-yil.*
