<?php
/*
Plugin Name: Media Linked Library
Plugin URI:  https://github.com/ole1986/media-linked-library
Description: Support for adding media files to page/post content using the IDs instead of URLs
Version:     1.0.1
Author:      ole1986
Author URI:  https://profiles.wordpress.org/ole1986
License:     GPL2
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Domain Path: /languages
Text Domain: media-linked-library
*/

define( 'MLL_ROOT_URL', plugin_dir_url( __FILE__ ) );

if(!defined('WP_UPLOAD_URI')) {
    $uploadDir = wp_upload_dir();
    define('WP_UPLOAD_URI', $uploadDir['baseurl']);
}

class MediaLinkedLibrary {    
    public function __construct(){
        // some global JS
        add_action('admin_head', array(&$this, 'script_header'));
        
        // TinyMCC Editor button and media plugin      
        add_filter( 'mce_buttons', array(&$this, 'register_tinymce_button') );
        add_filter( 'mce_external_plugins', array(&$this,'register_tinymce_plugin') );

        // register the shortcode [mediaref ...]
        add_shortcode('mediaref', array(&$this, 'media_reference_shortcode'));
        
        // ajax request to fetch media info
        add_action( 'wp_ajax_media_get', array(&$this,'media_get_callback') );
        add_action( 'wp_ajax_media_search', array(&$this,'media_search_callback') );
        add_action( 'wp_ajax_wp_handle_upload', array(&$this,'media_upload_callback') );
        //add_action( 'wp_ajax_media_upload_nonce', array(&$this,'media_upload_nonce') );
        // ajax request to fetch media categories (if available)
        add_action( 'wp_ajax_taxonomy_get', array(&$this, 'taxonomy_get_callback') );

        
        // Add Bulk operations in Media library (DropDown menu) to allow adding and removing categories
        add_action('load-upload.php',  array(&$this, 'media_bulkaction_submit'));
        add_action('admin_footer', array(&$this, 'media_bulkaction_category'));
    }
    
    /**
     * Some global JS variabled being used by mll-tinymce-plugin.js
     */
    public function script_header(){
        echo "<script>
        var MLL_UPLOAD_URL = '".WP_UPLOAD_URI."/';
        var MLL_PLUGIN_URL = '".MLL_ROOT_URL."';
        var MLL_IMAGE_NOTFOUND = '/mll-noimage.png';
        var MLL_IMAGE_BUTTON = '/mll-button.png';
        </script>";
    }
    
    /**
     * TinyMCE: Used to register the TinyMCE Editor button (with an image)
     */
    public function register_tinymce_button( $button_array ) {
        global $current_screen; //  WordPress contextual information about where we are.

        $type = $current_screen->post_type;

        if( is_admin() && ( $type == 'post' || $type == 'page' ) ) {
            array_push( $button_array, 'mll_button' );
        }

        return $button_array;
    }
    
    /**
     * TinyMCE: Register the new plugin 'mll_plugin' for TinyMCE
     */
    public function register_tinymce_plugin( $plugin_array ) {
        global $current_screen; //  WordPress contextual information about where we are.

        $type = $current_screen->post_type;

        if( is_admin() && ( $type == 'post' || $type == 'page' ) ) {
            $plugin_array['mll_plugin'] = MLL_ROOT_URL . 'js/mll-tinymce-plugin.js';
        }

        return $plugin_array;
    }
    
    /**
     * SHORTCODE: Register the shortcode '[mediaref id=<attachment Id> link=<media id> width=<width> height=<height>]'
     */
    public function media_reference_shortcode($attr){
        $imgmeta = wp_get_attachment_metadata(intval($attr['id']));
        // take the best matching image according to the defined size
        if($imgmeta === false) return '';
        
        $w = intval($attr['width']);
        $h = intval($attr['height']);
        
        $dir = dirname($imgmeta['file']);
        $best = ['height' => $imgmeta['height'], 'width' => $imgmeta['width'], 'file' => $imgmeta['file']];
        
        if(count($imgmeta['sizes']) > 0 && $w > 0 && $h > 0) {
             foreach($imgmeta['sizes'] as $ident => $prop) {
                if(($prop['width'] >= $w && $prop['height'] >= $h) && ($best['width'] > $prop['width'] && $best['height'] > $prop['height']))
                    $best = ['width' => $prop['width'], 'height' => $prop['height'], 'file' => $dir .'/' . $prop['file']];
            }
        }
        
        $result = '<p>';
        if(isset($attr['link'])) {
            $link = get_post_meta(intval($attr['link']), '_wp_attached_file',true);
            $newwnd = '';
            if(isset($attr['newwindow']) && $attr['newwindow'] == 'true')
                $newwnd = '_blank';
            $result.= sprintf('<a href="%s" target="%s">', WP_UPLOAD_URI . '/' .  $link, $newwnd);
        }
        
        $style = '';
        if($w > 0) $style.= "width:{$w}px;";
        if($h > 0) $style.= "height:{$h}px;";
        $result.= '<img src="'. WP_UPLOAD_URI .'/' . $best['file'].'" style="' . $style . '" />';
        
        if(isset($attr['link'])) $result.= '</a>';
        
        $result.= '</p>';
        
        return $result;
    }
    
    public function taxonomy_get_callback(){
        $terms = get_terms(['taxonomy' => "media_category", 'hide_empty' => 0]);
        
        echo json_encode($terms);
        
        wp_die();
    }
    public function media_get_callback(){
        $media = $this->getMedia($_POST['media_id'], true);
        echo json_encode(['ID' => $media->ID, 'post_title' => $media->post_title, 'post_mime_type' => $media->post_mime_type, 'path' => $media->path]);
        
        wp_die();
    }
    
    public function media_search_callback(){
        $mediaList = $this->searchMedia($_POST['filter'], $_POST['category'], [0,10], true, true);
        echo json_encode($mediaList);
        
        wp_die();
    }
    
    public function media_upload_callback(){
        $movefile = wp_handle_upload( $_FILES['file']);
        
        if($movefile && !isset($movefile['error'])) {
            $title = preg_replace('/\\.[^.\\s]{3,4}$/', '', basename($movefile['url']));
            $attachment_id = wp_insert_attachment( ['post_title' => $title, 'post_mime_type' => $movefile['type'] ], $movefile['file']);
            // generate the thumbnail
            $metadata = wp_generate_attachment_metadata($attachment_id, $movefile['file']);
            wp_update_attachment_metadata($attachment_id, $metadata);
            
            echo $attachment_id;
        } else {
            error_log("Error uploading file");
            echo "0";
        }
        
        wp_die();
    }
        
    private function searchMedia($filter, $category, $limit = [0,10], $withThumbnail = false, $withPath = false) {
        global $wpdb;
        
        $category = intval($category);
        
        $query = "SELECT ID, post_title,post_mime_type FROM $wpdb->posts AS t1";
        if($category > 0)
            $query.= " LEFT JOIN $wpdb->term_relationships AS t2 ON (t2.object_id = t1.ID)";
        
        $query.= " WHERE t1.post_type = 'attachment' AND post_title LIKE %s";
        if($category > 0)
            $query.= " AND t2.term_taxonomy_id = %d";

        $query.=' LIMIT %d, %d';
        
        if($category > 0)
            $query = $wpdb->prepare($query, '%' . $filter . '%', $category, $limit[0], $limit[1]);
        else
            $query = $wpdb->prepare($query, '%' . $filter . '%', $limit[0], $limit[1]);
        
        $posts = $wpdb->get_results($query, OBJECT);
        
        $postIds = array_map(function($p) { return $p->ID; }, $posts);
        
        if($withThumbnail && count($postIds) > 0) {
            $query = sprintf("SELECT post_id, meta_value FROM $wpdb->postmeta WHERE post_id IN (%s) AND meta_key = '_wp_attachment_metadata'", implode(',',$postIds) );
            $meta = $wpdb->get_results($query, OBJECT_K);
            foreach ($posts as $post) {
                if(isset($meta[$post->ID])) {
                    $metadata = unserialize($meta[$post->ID]->meta_value);
                    
                    $post->path = $metadata['file'];
                    // chekc if thumbnail is available
                    if(isset($metadata['sizes']['thumbnail'])) {
                        $post->thumbnail = dirname($post->path) . '/' . $metadata['sizes']['thumbnail']['file'];
                    }
                }
            }
        }
        
        return $posts;
    }
    
    private function getMedia($media_id, $withMetadata = false) {
        $media_id = intval($media_id);
        if($media_id <= 0) return;
        
        $media = get_post($media_id);
        if($withMetadata)
            $media->path = get_post_meta($media_id, '_wp_attached_file', true);
        
        return $media;
    }   
    
    // MEDIA: BULK ACTION ALLOW CATEGORIES FROM MEDIA LIST - START
    public function media_bulkaction_category() {
        global $pagenow;
        if($pagenow != 'upload.php') return;
        
        $terms = get_terms(['taxonomy' => "media_category", 'hide_empty' => 0]);
        ?>
        <script type="text/javascript">
            jQuery(document).ready(function() {
            <?php foreach ($terms as $v) {
                echo "jQuery('<option>').val('cat:".$v->term_id."').text('Category: ".$v->name."').appendTo('.actions > select');";
            }
            
            echo "jQuery('<option>').val('uncat').text('UnCategories').appendTo('.actions > select');";
            ?>
            });
        </script>
        <?php
    }
    
    public function media_bulkaction_submit() {
        if (isset( $_REQUEST['detached']) ) return;

        // get the action
        $wp_list_table = _get_list_table('WP_Media_List_Table'); 
        $action = $wp_list_table->current_action();
        
        if(!preg_match('/^cat:([0-9]+)|uncat$/', $action, $regs)) return;
        
        // make sure ids are submitted.  depending on the resource type, this may be 'media' or 'ids'
        if(isset($_REQUEST['media'])) $post_ids = array_map('intval', $_REQUEST['media']);
        if(empty($post_ids)) return;
        
        // this is based on wp-admin/edit.php
        $sendback = remove_query_arg( array('exported', 'untrashed', 'deleted', 'ids'), wp_get_referer() );
        if ( ! $sendback ) $sendback = admin_url( "upload.php?post_type=$post_type" );

        $pagenum = $wp_list_table->get_pagenum();
        $sendback = add_query_arg( 'paged', $pagenum, $sendback );

        if(count($regs) > 1) {
            foreach($post_ids as $id) {
                wp_delete_object_term_relationships($id, 'media_category');
                wp_set_object_terms($id, [intval($regs[1])], 'media_category');
            }
        } else {
            foreach($post_ids as $id) {
                wp_delete_object_term_relationships($id, 'media_category');
            }
        }
        
        $sendback = remove_query_arg( array('action', 'action2', 'tags_input', 'post_author', 'comment_status', 'ping_status', '_status',  'post', 'bulk_edit', 'post_view'), $sendback );
        wp_redirect($sendback);
        exit();
    }
    // MEDIA: BULK ACTION ALLOW CATEGORIES FROM MEDIA LIST - END
}

new MediaLinkedLibrary();
?>