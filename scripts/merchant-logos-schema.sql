-- ========================================================
-- arthaX Production Logo Management System - Database Schema
-- Project: ytqqzeemkzhifbtthanh
-- ========================================================

CREATE TABLE IF NOT EXISTS public.merchant_logos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    domain TEXT UNIQUE NOT NULL,
    category TEXT DEFAULT 'general',
    svg_url TEXT,
    png_url TEXT,
    webp_url TEXT,
    favicon_url TEXT,
    best_logo_url TEXT NOT NULL,
    provider TEXT NOT NULL,
    preferred_format TEXT NOT NULL DEFAULT 'png',
    etag TEXT,
    width INT,
    height INT,
    last_verified TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for instant domain & normalized name lookup
CREATE INDEX IF NOT EXISTS idx_merchant_logos_domain ON public.merchant_logos(domain);
CREATE INDEX IF NOT EXISTS idx_merchant_logos_normalized ON public.merchant_logos(normalized_name);
CREATE INDEX IF NOT EXISTS idx_merchant_logos_category ON public.merchant_logos(category);

-- Stored Procedure for Duplicate-Safe Upserts (following WHERE NOT EXISTS rule)
CREATE OR REPLACE FUNCTION public.upsert_merchant_logo(
    p_merchant_name TEXT,
    p_normalized_name TEXT,
    p_domain TEXT,
    p_category TEXT,
    p_svg_url TEXT,
    p_png_url TEXT,
    p_webp_url TEXT,
    p_favicon_url TEXT,
    p_best_logo_url TEXT,
    p_provider TEXT,
    p_preferred_format TEXT,
    p_etag TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.merchant_logos (
        merchant_name, normalized_name, domain, category,
        svg_url, png_url, webp_url, favicon_url,
        best_logo_url, provider, preferred_format, etag, last_verified, updated_at
    )
    SELECT 
        p_merchant_name, p_normalized_name, p_domain, p_category,
        p_svg_url, p_png_url, p_webp_url, p_favicon_url,
        p_best_logo_url, p_provider, p_preferred_format, p_etag, NOW(), NOW()
    WHERE NOT EXISTS (
        SELECT 1 FROM public.merchant_logos WHERE domain = p_domain
    );

    IF NOT FOUND THEN
        UPDATE public.merchant_logos
        SET 
            merchant_name = p_merchant_name,
            normalized_name = p_normalized_name,
            category = p_category,
            svg_url = COALESCE(p_svg_url, svg_url),
            png_url = COALESCE(p_png_url, png_url),
            webp_url = COALESCE(p_webp_url, webp_url),
            favicon_url = COALESCE(p_favicon_url, favicon_url),
            best_logo_url = p_best_logo_url,
            provider = p_provider,
            preferred_format = p_preferred_format,
            etag = p_etag,
            last_verified = NOW(),
            updated_at = NOW()
        WHERE domain = p_domain;
    END IF;
END;
$$ LANGUAGE plpgsql;
